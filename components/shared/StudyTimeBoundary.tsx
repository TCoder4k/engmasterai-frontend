import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Outlet } from 'react-router-dom';
import { authService, AUTH_CHANGED_EVENT } from '../../services/authService';
import { AuthExpiredError } from '../../services/apiError';
import { newUuidV4 } from '../../services/clientSessionId';
import { rotateIfExhausted } from '../../services/studySessionIdentity';
import {
  postStudyHeartbeat,
  StudyActivityType,
  StudyHeartbeatBody,
} from '../../services/studyTimeService';
import { sendStudyBeacon } from '../../services/studyTimeBeacon';
import {
  studyTimeLeader as defaultLeader,
  StudyTimeLeader,
} from '../../services/studyTimeLeader';

// Sprint 10.5 — the one place study time is measured.
//
// WHY A BOUNDARY AND NOT PER-PAGE TIMERS. Every learning surface would need the
// same visibility, idle, leader-lock, buffering and flush logic, and five copies
// of a one-second interval is five chances to leak one. Here there is exactly
// ONE interval for the whole session; pages contribute a registration and
// nothing else (useStudyActivity below creates no timer of its own).
//
// WHY A LAYOUT ROUTE. Same reasoning as GamificationProvider: each page renders
// its own StudentLayout, so a provider in there would remount on every
// navigation and restart the session. A layout route's element survives child
// route changes — which is also what makes "study for 20 minutes across four
// pages" one continuous session. Admin routes sit outside it by STRUCTURE and
// therefore never tick.
//
// WHAT COUNTS AS A STUDIED SECOND — all of these, every second:
//   authenticated · tab visible · a learning activity registered active ·
//   recent interaction OR media playing · this tab holds the leader lock.
//
// It is NOT page-open time. An idle tab, a background tab and a duplicate tab
// each contribute zero, which is the whole reason the widget can be honest.

/** The tick. One second is the unit the product is defined in. */
const TICK_MS = 1_000;

/** Silence after which a visible tab stops counting, unless media is playing. */
export const IDLE_TIMEOUT_MS = 60_000;

/** Buffered seconds at which a normal flush fires. */
export const FLUSH_THRESHOLD_SECONDS = 60;

/** Mirror of the backend DTO's @Max — a larger body is a guaranteed 400. */
const MAX_FLUSH_SECONDS = 75;

/**
 * Ceiling on unsent seconds. Beyond this, the oldest are dropped.
 *
 * A student offline for an hour must not come back and post an hour in one
 * burst: the server would refuse most of it anyway, and holding it implies a
 * durability guarantee this buffer deliberately does not offer.
 */
export const MAX_BUFFERED_SECONDS = 900;

/** How long to wait after a failed flush before trying again. */
const FLUSH_RETRY_BACKOFF_MS = 30_000;

/** Pointer movement is throttled to this before it counts as interaction. */
const POINTER_MOVE_THROTTLE_MS = 1_000;

export interface StudyActivityRegistration {
  type: StudyActivityType;
  activityId?: string;
  active: boolean;
  /**
   * True while media is genuinely playing.
   *
   * The ONLY idle bypass. A ten-minute video watched without touching anything
   * is real study, but nothing else may claim that exemption — it is why the
   * flag is a separate field rather than a variant of `active`.
   */
  mediaPlaying?: boolean;
}

interface StudyTimeContextValue {
  register: (id: number, entry: StudyActivityRegistration) => void;
  unregister: (id: number) => void;
}

const StudyTimeContext = createContext<StudyTimeContextValue | null>(null);

interface TrackedActivity {
  entry: StudyActivityRegistration;
  /** Monotonic, assigned when the entry BECOMES active. Highest wins. */
  activatedSeq: number;
}

let nextRegistrationId = 0;

export interface StudyTimeProviderProps {
  children: React.ReactNode;
  /** Injectable for tests, which need two "tabs" inside one jsdom. */
  leader?: StudyTimeLeader;
}

export const StudyTimeProvider: React.FC<StudyTimeProviderProps> = ({
  children,
  leader = defaultLeader,
}) => {
  // EVERYTHING BELOW IS A REF, NOT STATE, ON PURPOSE. A one-second interval
  // that called setState would re-render the entire student subtree 3,600 times
  // an hour to move a number no component below it reads.
  const activities = useRef(new Map<number, TrackedActivity>());
  const activationCounter = useRef(0);

  const bufferedSeconds = useRef(0);
  const clientSessionId = useRef(newUuidV4());
  const sequence = useRef(0);

  const lastInteractionAt = useRef(Date.now());
  const lastPointerMoveAt = useRef(0);

  const flushing = useRef(false);
  const nextFlushAllowedAt = useRef(0);
  const stopped = useRef(false);

  const knownUserId = useRef<string | null>(authService.getUser()?.id ?? null);

  /** The registration that owns the next credited second, or null. */
  const currentActivity = useCallback((): StudyActivityRegistration | null => {
    let winner: TrackedActivity | null = null;
    for (const tracked of activities.current.values()) {
      if (!tracked.entry.active) continue;
      // NEWEST ACTIVE WINS. LessonPage swaps stages inside
      // <AnimatePresence mode="wait">, so for a moment two stages are mounted
      // and both active. Without a deterministic rule the reported
      // activityType would flip between runs.
      if (!winner || tracked.activatedSeq > winner.activatedSeq) {
        winner = tracked;
      }
    }
    return winner?.entry ?? null;
  }, []);

  /** Drop everything session-scoped. Used on logout and on account change. */
  const resetSession = useCallback(() => {
    leader.release();
    bufferedSeconds.current = 0;
    clientSessionId.current = newUuidV4();
    sequence.current = 0;
    nextFlushAllowedAt.current = 0;
  }, [leader]);

  const buildBody = useCallback(
    (
      activity: StudyActivityRegistration,
      seconds: number,
    ): StudyHeartbeatBody => {
      // Rotate BEFORE the ceiling rather than on hitting it — see
      // rotateIfExhausted, where the rule lives and is tested.
      const identity = rotateIfExhausted({
        clientSessionId: clientSessionId.current,
        sequence: sequence.current,
      });
      clientSessionId.current = identity.clientSessionId;
      sequence.current = identity.sequence;

      return {
        clientSessionId: identity.clientSessionId,
        sequence: identity.sequence,
        activityType: activity.type,
        ...(activity.activityId ? { activityId: activity.activityId } : {}),
        activeSeconds: seconds,
      };
    },
    [],
  );

  /** The normal, foreground flush. Goes through apiFetch and may refresh auth. */
  const flush = useCallback(async () => {
    if (flushing.current || stopped.current) return;
    if (Date.now() < nextFlushAllowedAt.current) return;

    const activity = currentActivity();
    if (!activity) return;

    const seconds = Math.min(bufferedSeconds.current, MAX_FLUSH_SECONDS);
    if (seconds < 1) return;

    const body = buildBody(activity, seconds);

    flushing.current = true;
    // Optimistic: spend the buffer and advance the sequence before awaiting, so
    // a tick landing mid-request cannot send the same seconds twice.
    bufferedSeconds.current -= seconds;
    sequence.current += 1;

    try {
      await postStudyHeartbeat(body);
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        // The session is genuinely over. Keeping the seconds would mean posting
        // one student's time under whoever signs in next.
        stopped.current = true;
        resetSession();
        return;
      }
      // Give the seconds back, capped, and back off.
      //
      // This can double-count when the request actually reached the server and
      // only the RESPONSE was lost: the retry carries a fresh sequence, so the
      // idempotency key does not match. Accepted deliberately — the common
      // failure is offline (the server never saw it), and the server's daily
      // ceiling bounds the rare case. Losing real study time on every network
      // blip is the worse trade.
      bufferedSeconds.current = Math.min(
        bufferedSeconds.current + seconds,
        MAX_BUFFERED_SECONDS,
      );
      nextFlushAllowedAt.current = Date.now() + FLUSH_RETRY_BACKOFF_MS;
    } finally {
      flushing.current = false;
    }
  }, [buildBody, currentActivity, resetSession]);

  /**
   * The best-effort flush, for a tab going away or into the background.
   *
   * Consumes the buffer and advances the sequence exactly as a successful flush
   * would, without waiting to find out. If it was lost, at most one window is
   * lost with it — that is the documented trade, and it is strictly better than
   * keeping the seconds and re-sending them under a key the server has already
   * seen.
   */
  const flushBeacon = useCallback(() => {
    if (stopped.current) return;
    const activity = currentActivity();
    if (!activity) return;

    const seconds = Math.min(bufferedSeconds.current, MAX_FLUSH_SECONDS);
    if (seconds < 1) return;

    const body = buildBody(activity, seconds);
    bufferedSeconds.current -= seconds;
    sequence.current += 1;
    sendStudyBeacon(body);
  }, [buildBody, currentActivity]);

  // ---- THE ONE TIMER -------------------------------------------------------
  useEffect(() => {
    const tick = () => {
      if (stopped.current) return;

      // Logged out. Not an error state — just nothing to measure.
      if (!authService.getToken()) {
        if (bufferedSeconds.current > 0 || leader.isLeader()) resetSession();
        return;
      }

      const activity = currentActivity();
      if (!activity) {
        // NOT STUDYING -> NOT LEADER. This is what keeps an idle /home tab from
        // holding the lock while another tab does the actual work.
        leader.release();
        return;
      }

      const userId = authService.getUser()?.id;
      if (!userId) return;
      if (!leader.tryAcquire(userId)) return;

      if (document.visibilityState !== 'visible') return;

      const idle = Date.now() - lastInteractionAt.current >= IDLE_TIMEOUT_MS;
      if (idle && !activity.mediaPlaying) return;

      bufferedSeconds.current = Math.min(
        bufferedSeconds.current + 1,
        MAX_BUFFERED_SECONDS,
      );

      if (bufferedSeconds.current >= FLUSH_THRESHOLD_SECONDS) {
        void flush();
      }
    };

    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [currentActivity, flush, leader, resetSession]);

  // ---- interaction, visibility, unload, auth --------------------------------
  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAt.current = Date.now();
    };

    // Throttled by timestamp, not by a timer — the boundary owns exactly one.
    const onPointerMove = () => {
      const now = Date.now();
      if (now - lastPointerMoveAt.current < POINTER_MOVE_THROTTLE_MS) return;
      lastPointerMoveAt.current = now;
      lastInteractionAt.current = now;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Returning to a tab is itself interaction; without this the student
        // has to move the mouse before a long-idle tab starts counting again.
        markInteraction();
        return;
      }
      flushBeacon();
    };

    const onPageHide = () => flushBeacon();

    // Same-document auth change (login, logout, forced logout) — and also a
    // routine token refresh, which is why the USER ID is compared rather than
    // resetting on every event. Resetting on refresh would discard the buffer
    // and restart the session every ten minutes.
    const onAuthChanged = () => {
      const userId = authService.getUser()?.id ?? null;
      if (userId === knownUserId.current) return;
      knownUserId.current = userId;
      stopped.current = false;
      resetSession();
    };

    // CROSS-TAB. AUTH_CHANGED_EVENT is a window event and does not leave its
    // own document, so a logout in another tab is invisible to it. The storage
    // event is the only signal that crosses, and without it this tab would keep
    // crediting the previous account's session.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== 'user' && event.key !== 'accessToken') {
        return;
      }
      const userId = authService.getUser()?.id ?? null;
      if (userId === knownUserId.current) return;
      knownUserId.current = userId;
      stopped.current = false;
      resetSession();
    };

    const passive = { passive: true } as const;
    window.addEventListener('pointerdown', markInteraction, passive);
    window.addEventListener('keydown', markInteraction, passive);
    window.addEventListener('wheel', markInteraction, passive);
    window.addEventListener('touchstart', markInteraction, passive);
    window.addEventListener('scroll', markInteraction, passive);
    window.addEventListener('pointermove', onPointerMove, passive);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('wheel', markInteraction);
      window.removeEventListener('touchstart', markInteraction);
      window.removeEventListener('scroll', markInteraction);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorage);
      // A tab closing without pagehide (crash, forced kill) loses its buffer.
      // Deliberate: no unsent seconds are written to storage, so nothing can be
      // replayed into a later session by a different account.
      leader.release();
    };
  }, [flushBeacon, leader, resetSession]);

  const register = useCallback((id: number, entry: StudyActivityRegistration) => {
    const existing = activities.current.get(id);
    // The activation sequence only moves when an entry goes inactive -> active,
    // so toggling mediaPlaying mid-video does not make the video jump ahead of
    // a stage registered after it.
    const activatedSeq =
      existing && existing.entry.active && entry.active
        ? existing.activatedSeq
        : (activationCounter.current += 1);
    activities.current.set(id, { entry, activatedSeq });
  }, []);

  const unregister = useCallback(
    (id: number) => {
      activities.current.delete(id);
      // RELEASE ON THE LAST ONE. Leaving the lock held by a tab that has
      // navigated to the dashboard would block a second tab that is still
      // learning.
      const stillActive = [...activities.current.values()].some(
        (tracked) => tracked.entry.active,
      );
      if (!stillActive) leader.release();
    },
    [leader],
  );

  const value = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <StudyTimeContext.Provider value={value}>
      {children}
    </StudyTimeContext.Provider>
  );
};

export interface UseStudyActivityOptions {
  type: StudyActivityType;
  activityId?: string;
  active: boolean;
  mediaPlaying?: boolean;
}

/**
 * Declare that this component is a learning activity.
 *
 * Registration only — it starts no timer, holds no state and issues no request.
 * Outside the provider it is a no-op rather than a throw, matching
 * useGamification: the same components render in tests and (for shared ones) on
 * admin routes, and neither should crash for want of a tracker.
 */
export const useStudyActivity = ({
  type,
  activityId,
  active,
  mediaPlaying,
}: UseStudyActivityOptions): void => {
  const context = useContext(StudyTimeContext);
  const idRef = useRef<number>(-1);
  if (idRef.current === -1) {
    idRef.current = (nextRegistrationId += 1);
  }

  useEffect(() => {
    if (!context) return;
    context.register(idRef.current, {
      type,
      activityId,
      active,
      mediaPlaying,
    });
  }, [context, type, activityId, active, mediaPlaying]);

  // Unregister only on unmount — a separate effect so a changing `active` does
  // not tear the registration down and rebuild it (which would also reorder it
  // against its siblings).
  useEffect(() => {
    const id = idRef.current;
    return () => context?.unregister(id);
  }, [context]);
};

/**
 * The layout route that scopes tracking to student pages.
 *
 * Nested inside GamificationBoundary in App.tsx. Admin routes are outside both,
 * so they issue no heartbeat at all — by structure, not by a check.
 */
const StudyTimeBoundary: React.FC = () => (
  <StudyTimeProvider>
    <Outlet />
  </StudyTimeProvider>
);

export default StudyTimeBoundary;
