import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FLUSH_THRESHOLD_SECONDS,
  IDLE_TIMEOUT_MS,
  StudyTimeProvider,
  useStudyActivity,
} from './StudyTimeBoundary';
import { createStudyTimeLeader } from '../../services/studyTimeLeader';
import * as studyTimeService from '../../services/studyTimeService';
import * as studyTimeBeacon from '../../services/studyTimeBeacon';
import { AUTH_CHANGED_EVENT } from '../../services/authService';

// Sprint 10.5 — the tracking manager.
//
// Everything here is driven by fake timers over the boundary's single
// one-second interval. The assertions are about what is NOT credited at least
// as much as what is: idle time, hidden tabs and duplicate tabs contributing
// zero is the entire reason the Daily Goal figure can be honest.

const USER = { id: 'user-1', name: 'A', email: 'a@b.c', role: 'USER', emailVerified: true };

const signIn = (id = 'user-1') => {
  localStorage.setItem('accessToken', 'token-abc');
  localStorage.setItem('user', JSON.stringify({ ...USER, id }));
};

/** A component that registers one activity. */
const Activity: React.FC<{
  type?: studyTimeService.StudyActivityType;
  activityId?: string;
  active?: boolean;
  mediaPlaying?: boolean;
}> = ({ type = 'THEORY', activityId, active = true, mediaPlaying }) => {
  useStudyActivity({ type, activityId, active, mediaPlaying });
  return null;
};

/** Advance the boundary's interval by `seconds` whole ticks, in one jump. */
const tick = async (seconds: number) => {
  await act(async () => {
    vi.advanceTimersByTime(seconds * 1000);
  });
};

// TWO REASONS THESE LOOP ONE SECOND AT A TIME rather than jumping.
//
// 1. IDLE_TIMEOUT_MS is 60s and so is the flush threshold, so a 60-second jump
//    with no interaction hits idle on the very tick that would have crossed the
//    threshold. That is correct behaviour, not a bug — but it means "study for
//    a minute" has to look like studying.
// 2. flush() is async and guards against re-entry. A synchronous 180-second
//    jump runs 180 ticks before a single microtask resolves, so only the first
//    flush can complete. Awaiting each second lets them settle.

/** Study actively: one tick per second, interacting each time. */
const studyFor = async (seconds: number) => {
  for (let second = 0; second < seconds; second += 1) {
    await tick(1);
    window.dispatchEvent(new Event('keydown'));
  }
};

/** Sit still: one tick per second, touching nothing. */
const idleFor = async (seconds: number) => {
  for (let second = 0; second < seconds; second += 1) {
    await tick(1);
  }
};

let postSpy: ReturnType<typeof vi.spyOn>;
let beaconSpy: ReturnType<typeof vi.spyOn>;

const renderBoundary = (
  children: React.ReactNode,
  tabId = 'tab-a',
) => {
  const leader = createStudyTimeLeader(tabId);
  const utils = render(
    <StudyTimeProvider leader={leader}>{children}</StudyTimeProvider>,
  );
  return { ...utils, leader };
};

beforeEach(() => {
  localStorage.clear();
  signIn();
  vi.useFakeTimers();
  postSpy = vi
    .spyOn(studyTimeService, 'postStudyHeartbeat')
    .mockResolvedValue({ acceptedSeconds: 60 });
  beaconSpy = vi.spyOn(studyTimeBeacon, 'sendStudyBeacon').mockImplementation(() => {});
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('StudyTimeBoundary — what does NOT count', () => {
  it('credits nothing and sends nothing with no active activity', async () => {
    renderBoundary(null);

    await tick(FLUSH_THRESHOLD_SECONDS * 2);

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('credits nothing while an activity is registered INACTIVE', async () => {
    renderBoundary(<Activity active={false} />);

    await tick(FLUSH_THRESHOLD_SECONDS * 2);

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('credits nothing while the tab is hidden', async () => {
    renderBoundary(<Activity />);
    setHidden(true);

    await tick(FLUSH_THRESHOLD_SECONDS * 2);

    expect(postSpy).not.toHaveBeenCalled();
  });

  // Reading a page for a minute without touching anything is the boundary
  // between "studying" and "left the tab open".
  // Sitting still credits at most one idle window and then nothing, however
  // long the tab stays open. Measured through the pagehide beacon, because a
  // buffer that never reaches the flush threshold is otherwise invisible.
  it('stops crediting after the idle timeout', async () => {
    renderBoundary(<Activity />);

    await idleFor(IDLE_TIMEOUT_MS / 1000 + 600);
    window.dispatchEvent(new Event('pagehide'));

    expect(postSpy).not.toHaveBeenCalled();
    expect(beaconSpy).toHaveBeenCalledTimes(1);
    // Ten more minutes of sitting there added nothing to the first minute.
    expect(
      (beaconSpy.mock.calls[0][0] as { activeSeconds: number }).activeSeconds,
    ).toBeLessThanOrEqual(IDLE_TIMEOUT_MS / 1000);
  });

  it('keeps crediting while the student interacts', async () => {
    renderBoundary(<Activity />);

    await studyFor(180);

    expect(postSpy).toHaveBeenCalledTimes(3);
  });

  // The ONE idle bypass. A ten-minute video is watched without touching
  // anything, and it is unambiguously study.
  it('keeps crediting an idle tab while media is playing', async () => {
    renderBoundary(<Activity type="VIDEO" mediaPlaying />);

    await idleFor(180);

    expect(postSpy).toHaveBeenCalledTimes(3);
  });

  it('stops crediting when that same media pauses', async () => {
    const leader = createStudyTimeLeader('tab-a');
    const { rerender } = render(
      <StudyTimeProvider leader={leader}>
        <Activity type="VIDEO" mediaPlaying />
      </StudyTimeProvider>,
    );
    await idleFor(120);
    expect(postSpy).toHaveBeenCalledTimes(2);

    rerender(
      <StudyTimeProvider leader={leader}>
        <Activity type="VIDEO" mediaPlaying={false} />
      </StudyTimeProvider>,
    );
    await idleFor(300);

    // Paused and untouched is idle again — no further flush.
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('stops crediting after logout', async () => {
    renderBoundary(<Activity />);
    await tick(10);

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');

    await tick(FLUSH_THRESHOLD_SECONDS * 2);

    expect(postSpy).not.toHaveBeenCalled();
  });
});

describe('StudyTimeBoundary — the leader lock', () => {
  it('claims the lock only once an activity is active', async () => {
    const { leader } = renderBoundary(null);

    await tick(3);
    expect(leader.isLeader()).toBe(false);
  });

  // THE REGRESSION THIS RULE EXISTS FOR. /home open in one tab and a lesson in
  // another is the most ordinary arrangement in the app. If the idle tab could
  // take the lock, the student would earn nothing at all.
  it('lets a learning tab win while an inactive tab is open', async () => {
    const homeTab = renderBoundary(null, 'tab-home');
    const lessonLeader = createStudyTimeLeader('tab-lesson');
    render(
      <StudyTimeProvider leader={lessonLeader}>
        <Activity />
      </StudyTimeProvider>,
    );

    await studyFor(FLUSH_THRESHOLD_SECONDS);

    expect(homeTab.leader.isLeader()).toBe(false);
    expect(lessonLeader.isLeader()).toBe(true);
    // And the learning tab actually got credited, rather than both tabs
    // sitting deadlocked on a lock neither could use.
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('releases the lock when the last activity unregisters', async () => {
    const Wrapper: React.FC<{ show: boolean }> = ({ show }) => (
      <>{show ? <Activity /> : null}</>
    );
    const leader = createStudyTimeLeader('tab-a');
    const { rerender } = render(
      <StudyTimeProvider leader={leader}>
        <Wrapper show />
      </StudyTimeProvider>,
    );

    await tick(3);
    expect(leader.isLeader()).toBe(true);

    rerender(
      <StudyTimeProvider leader={leader}>
        <Wrapper show={false} />
      </StudyTimeProvider>,
    );

    expect(leader.isLeader()).toBe(false);
  });

  it('releases the lock when every activity goes inactive', async () => {
    const leader = createStudyTimeLeader('tab-a');
    const { rerender } = render(
      <StudyTimeProvider leader={leader}>
        <Activity active />
      </StudyTimeProvider>,
    );
    await tick(3);
    expect(leader.isLeader()).toBe(true);

    rerender(
      <StudyTimeProvider leader={leader}>
        <Activity active={false} />
      </StudyTimeProvider>,
    );
    await tick(2);

    expect(leader.isLeader()).toBe(false);
  });
});

describe('StudyTimeBoundary — activity resolution', () => {
  // LessonPage swaps stages inside <AnimatePresence mode="wait">, so two
  // stages are briefly mounted together. Without a deterministic rule the
  // reported activityType would depend on mount order.
  it('reports the most recently registered active activity', async () => {
    renderBoundary(
      <>
        <Activity type="THEORY" activityId="lesson-old" />
        <Activity type="QUIZ" activityId="lesson-new" />
      </>,
    );

    await studyFor(FLUSH_THRESHOLD_SECONDS);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][0]).toMatchObject({
      activityType: 'QUIZ',
      activityId: 'lesson-new',
    });
  });

  it('still credits only ONE second per real second with two activities', async () => {
    renderBoundary(
      <>
        <Activity type="THEORY" />
        <Activity type="QUIZ" />
      </>,
    );

    await studyFor(FLUSH_THRESHOLD_SECONDS);

    // Two registrations, one flush of exactly 60 seconds — not two, and not 120.
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][0]).toMatchObject({ activeSeconds: 60 });
  });
});

describe('StudyTimeBoundary — flushing', () => {
  it('uses the apiFetch-backed service for the normal flush', async () => {
    renderBoundary(<Activity />);

    await studyFor(FLUSH_THRESHOLD_SECONDS);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(postSpy.mock.calls[0][0]).toMatchObject({
      activityType: 'THEORY',
      activeSeconds: FLUSH_THRESHOLD_SECONDS,
      sequence: 0,
    });
  });

  it('advances the sequence across flushes within one session', async () => {
    renderBoundary(<Activity />);

    await studyFor(FLUSH_THRESHOLD_SECONDS * 2);

    expect(postSpy.mock.calls[0][0]).toMatchObject({ sequence: 0 });
    expect(postSpy.mock.calls[1][0]).toMatchObject({ sequence: 1 });
    expect(postSpy.mock.calls[1][0].clientSessionId).toBe(
      postSpy.mock.calls[0][0].clientSessionId,
    );
  });

  it('uses the BEACON, not the service, when the tab is hidden', async () => {
    renderBoundary(<Activity />);
    await tick(20);

    setHidden(true);

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    expect(beaconSpy.mock.calls[0][0]).toMatchObject({ activeSeconds: 20 });
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('uses the beacon on pagehide', async () => {
    renderBoundary(<Activity />);
    await tick(15);

    window.dispatchEvent(new Event('pagehide'));

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    expect(beaconSpy.mock.calls[0][0]).toMatchObject({ activeSeconds: 15 });
  });

  it('sends no beacon when there is nothing buffered', async () => {
    renderBoundary(<Activity />);

    window.dispatchEvent(new Event('pagehide'));

    expect(beaconSpy).not.toHaveBeenCalled();
  });

  it('re-buffers and retries after a failed flush', async () => {
    postSpy.mockRejectedValueOnce(new Error('offline'));
    renderBoundary(<Activity />);

    await studyFor(FLUSH_THRESHOLD_SECONDS);
    expect(postSpy).toHaveBeenCalledTimes(1);

    // Backoff (30s), then the re-buffered seconds go again.
    await studyFor(60);

    expect(postSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(postSpy.mock.calls[1][0].activeSeconds).toBeGreaterThanOrEqual(60);
  });
});

describe('StudyTimeBoundary — account changes', () => {
  it('resets the session when another tab signs in as someone else', async () => {
    const { leader } = renderBoundary(<Activity />);
    await tick(20);
    expect(leader.isLeader()).toBe(true);

    // A storage event is the ONLY cross-tab signal: AUTH_CHANGED_EVENT is a
    // window event and never leaves its own document.
    act(() => {
      signIn('user-2');
      window.dispatchEvent(new StorageEvent('storage', { key: 'user' }));
    });

    expect(leader.isLeader()).toBe(false);

    // The 20 buffered seconds belonged to user-1 and must not be posted now.
    await tick(30);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('resets when another tab logs out', async () => {
    const { leader } = renderBoundary(<Activity />);
    await tick(20);

    act(() => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
    });

    expect(leader.isLeader()).toBe(false);
    await tick(FLUSH_THRESHOLD_SECONDS * 2);
    expect(postSpy).not.toHaveBeenCalled();
  });

  // A token refresh fires AUTH_CHANGED_EVENT every ten minutes. Treating that
  // as an account change would discard the buffer and restart the session on a
  // timer, losing up to a minute each time.
  it('does NOT reset on a token refresh for the same user', async () => {
    renderBoundary(<Activity />);
    await tick(30);

    act(() => {
      localStorage.setItem('accessToken', 'token-rotated');
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    });

    await studyFor(30);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][0]).toMatchObject({ activeSeconds: 60 });
  });
});

describe('StudyTimeBoundary — cleanup', () => {
  it('clears the interval and stops crediting after unmount', async () => {
    const { unmount } = renderBoundary(<Activity />);
    await tick(10);

    unmount();
    await tick(FLUSH_THRESHOLD_SECONDS * 3);

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('removes every listener it added', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderBoundary(<Activity />);
    const added = addSpy.mock.calls.map(([event]) => event).sort();
    unmount();
    const removed = removeSpy.mock.calls.map(([event]) => event).sort();

    expect(added.length).toBeGreaterThan(0);
    expect(removed).toEqual(added);
  });

  it('releases the leader lock on unmount', async () => {
    const { unmount, leader } = renderBoundary(<Activity />);
    await tick(3);
    expect(leader.isLeader()).toBe(true);

    unmount();

    expect(leader.isLeader()).toBe(false);
  });

  it('owns exactly ONE interval', () => {
    const intervalSpy = vi.spyOn(window, 'setInterval');

    renderBoundary(
      <>
        <Activity type="THEORY" />
        <Activity type="QUIZ" />
        <Activity type="VIDEO" mediaPlaying />
      </>,
    );

    // Three registrations, one timer. Hooks must never create their own.
    expect(intervalSpy).toHaveBeenCalledTimes(1);
  });
});

describe('useStudyActivity — outside the provider', () => {
  it('is a no-op rather than a throw', () => {
    // The same components render in tests and in isolation; neither should
    // crash for want of a tracker. Matches useGamification's contract.
    expect(() => render(<Activity />)).not.toThrow();
  });
});
