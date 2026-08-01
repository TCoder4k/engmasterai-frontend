import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Outlet } from 'react-router-dom';
import {
  GamificationProfile,
  GamificationResult,
  getGamificationProfile,
  onGamificationAward,
} from '../../services/gamificationService';
import XpToast from '../user/XpToast';

// Sprint 10 — one XP profile for the whole student session.
//
// WHY A PROVIDER AND NOT A PER-PAGE FETCH. The level widget lives in
// StudentDesktopSidebar, which StudentLayout renders on EVERY student route.
// Fetching where it renders would mean a request on every navigation; fetching
// in UserHome (the obvious alternative) would leave the widget blank on the
// other ten pages.
//
// WHY IT IS MOUNTED AS A LAYOUT ROUTE, not inside StudentLayout. Each page
// renders its own <StudentLayout>, so a provider in there would REMOUNT on
// every navigation and refetch anyway. A layout route's element survives child
// route changes, so this mounts once per session.
//
// It is deliberately small. Three states, one refresh, one optimistic update —
// not a cache library. The codebase has no data-fetching layer and Sprint 10 is
// not the sprint to introduce one.

/**
 * How long the XP toast stays on screen.
 *
 * Exported so the test asserts the same number the component uses, rather than
 * a literal that can drift away from it. Short on purpose: the toast is a
 * garnish over the level widget, which is the durable place the student looks —
 * see XpToast. Nothing about the DATA update depends on this; the profile is
 * folded the moment the award arrives, whether or not the toast is still up.
 */
export const XP_TOAST_DURATION_MS = 1000;

/**
 * Fold one award into a cached profile.
 *
 * Pure, and every field it writes is the SERVER's — `result.xp` is the same
 * LevelProgress that GET /gamification/profile returns, so the bar, the level
 * and the "N XP to next level" caption all move together and none of them is
 * recomputed here. Duplicating the XP curve in the client is exactly how the
 * two would drift.
 *
 * Applying the same result twice is a no-op, because every number is absolute
 * rather than a delta. That is what makes a duplicated response harmless.
 */
const foldOutcome = (
  current: GamificationProfile,
  result: GamificationResult,
): GamificationProfile => {
  // The ledger only ever writes positive amounts, so a total BELOW the one
  // already on screen cannot be newer — it is a stale or out-of-order response
  // and applying it would visibly roll the student backwards.
  if (result.xp.totalXp < current.xp.totalXp) return current;

  const unlockedNow = new Set(result.unlockedAchievements);
  return {
    ...current,
    xp: result.xp,
    achievements: current.achievements.map((achievement) =>
      unlockedNow.has(achievement.key) && !achievement.unlockedAt
        ? {
            ...achievement,
            unlockedAt: new Date().toISOString(),
            progress: null,
          }
        : achievement,
    ),
  };
};

interface GamificationContextValue {
  /** `undefined` = loading, `null` = failed, object = loaded. */
  profile: GamificationProfile | null | undefined;
  /** Refetch from scratch. The recovery path behind the widget's retry. */
  refresh: () => void;
  /**
   * Fold the result of a learning action into the cached profile.
   *
   * This is what keeps the level widget honest the moment a stage is finished,
   * with no extra request: the write endpoints already return the new totals.
   * A no-op when nothing was awarded — a replayed submit reports
   * `xpAwarded: 0` and must not disturb anything on screen.
   */
  applyOutcome: (result: GamificationResult) => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

/**
 * Subscribe to the student's XP profile.
 *
 * Returns `null` outside the provider rather than throwing, so a component
 * that is also rendered on an admin route (or in a test) degrades to showing
 * nothing instead of crashing the page.
 */
export const useGamification = (): GamificationContextValue | null =>
  useContext(GamificationContext);

export const GamificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<GamificationProfile | null | undefined>(
    undefined,
  );
  const [attempt, setAttempt] = useState(0);
  /** The award currently being announced, or null. */
  const [award, setAward] = useState<GamificationResult | null>(null);

  // Awards that landed while the profile request was in flight.
  //
  // WHY THIS EXISTS. The two are genuinely concurrent: LessonPage marks theory
  // as started from a mount effect, so on a hard load of a lesson the award and
  // the provider's own GET leave at the same moment. Without a queue the award
  // is dropped (there is no cached profile to fold it into) while the toast —
  // which subscribes separately — still fires. That is Sprint 10 QA's "the
  // toast moved and the widget did not", in its second, rarer form.
  const pendingAwards = useRef<GamificationResult[]>([]);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    inFlight.current = true;
    pendingAwards.current = [];
    getGamificationProfile()
      .then((data) => {
        if (cancelled) return;
        // The payload was computed BEFORE anything queued below it, so the
        // queue goes on top. Not the other way round: a response in flight
        // during an award would otherwise overwrite the award with a total
        // that predates it.
        setProfile(pendingAwards.current.reduce(foldOutcome, data));
      })
      .catch(() => {
        // `null`, never a zeroed payload. A student at level 6 must never see
        // "Level 1" because a request failed — that is a false statement, not
        // an empty state. Same rule Sprint 08 set for course progress and
        // Sprint 09 for the dashboard widgets.
        //
        // The queue is discarded with it: there is no profile to fold onto, and
        // assembling one from an award's totals alone would invent an
        // achievement list nobody reported.
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (cancelled) return;
        inFlight.current = false;
        pendingAwards.current = [];
      });
    return () => {
      cancelled = true;
      inFlight.current = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const applyOutcome = useCallback((result: GamificationResult) => {
    if (result.xpAwarded === 0 && result.unlockedAchievements.length === 0) {
      return;
    }
    if (inFlight.current) {
      pendingAwards.current.push(result);
      return;
    }
    setProfile((current) => (current ? foldOutcome(current, result) : current));
  }, []);

  // Awards arrive from five endpoints (quiz submit, practice submit, the three
  // step writes, trap answer, SRS review) consumed by components that share no
  // ancestor below the router. Subscribing at the service boundary means every
  // one of them updates the level widget without a single prop being threaded
  // — and a future award site gets it for free instead of having to remember.
  // Same module-singleton shape as RefreshCoordinator.
  useEffect(() => onGamificationAward(applyOutcome), [applyOutcome]);

  // The toast the student actually sees. Rendered here, once, for the same
  // reason the subscription lives here.
  useEffect(() => onGamificationAward(setAward), []);

  // ONE timer, restarted whenever the announced award changes and cleared on
  // unmount. `award` is a single slot rather than a queue: a second award
  // replaces the first and gets the full window, which is the right trade at
  // this duration — queueing would make the last toast of a burst appear
  // seconds after the action that caused it.
  useEffect(() => {
    if (!award) return;
    const timer = window.setTimeout(() => setAward(null), XP_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [award]);

  const value = useMemo(
    () => ({ profile, refresh, applyOutcome }),
    [profile, refresh, applyOutcome],
  );

  return (
    <GamificationContext.Provider value={value}>
      {children}
      {award && <XpToast award={award} onDismiss={() => setAward(null)} />}
    </GamificationContext.Provider>
  );
};

/**
 * The layout route that scopes the provider to student pages.
 *
 * Nested UNDER ProtectedRoute rather than replacing it: ProtectedRoute is a
 * navigation gate and stays purely that. Admin routes sit outside this
 * boundary by STRUCTURE, so they issue no gamification request at all — no
 * lazy-subscription trick needed to achieve it.
 */
const GamificationBoundary: React.FC = () => (
  <GamificationProvider>
    <Outlet />
  </GamificationProvider>
);

export default GamificationBoundary;
