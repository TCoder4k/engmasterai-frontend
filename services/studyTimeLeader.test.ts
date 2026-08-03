import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStudyTimeLeader,
  LEADER_TTL_MS,
  STUDY_TIME_LEADER_KEY,
} from './studyTimeLeader';

// Two "tabs" inside one jsdom: two leader instances over the same localStorage.
// That is why createStudyTimeLeader is a factory rather than only a singleton.

describe('studyTimeLeader', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('grants the lock to the first tab that asks', () => {
    const tabA = createStudyTimeLeader('tab-a');

    expect(tabA.tryAcquire('user-1')).toBe(true);
    expect(tabA.isLeader()).toBe(true);
  });

  it('refuses a second tab while the first holds a live lease', () => {
    const tabA = createStudyTimeLeader('tab-a');
    const tabB = createStudyTimeLeader('tab-b');
    tabA.tryAcquire('user-1');

    expect(tabB.tryAcquire('user-1')).toBe(false);
    expect(tabB.isLeader()).toBe(false);
  });

  it('lets the same tab renew indefinitely', () => {
    const tabA = createStudyTimeLeader('tab-a');
    tabA.tryAcquire('user-1');

    vi.advanceTimersByTime(LEADER_TTL_MS / 2);

    expect(tabA.tryAcquire('user-1')).toBe(true);
    expect(tabA.isLeader()).toBe(true);
  });

  // FAILOVER. A tab that crashes never releases; the lease is what stops it
  // locking the student out for the rest of the session.
  it('hands over to another tab once the lease expires', () => {
    const tabA = createStudyTimeLeader('tab-a');
    const tabB = createStudyTimeLeader('tab-b');
    tabA.tryAcquire('user-1');

    vi.advanceTimersByTime(LEADER_TTL_MS + 1);

    expect(tabB.tryAcquire('user-1')).toBe(true);
    expect(tabB.isLeader()).toBe(true);
    expect(tabA.isLeader()).toBe(false);
  });

  it('releases on request and frees the next tab immediately', () => {
    const tabA = createStudyTimeLeader('tab-a');
    const tabB = createStudyTimeLeader('tab-b');
    tabA.tryAcquire('user-1');

    tabA.release();

    expect(localStorage.getItem(STUDY_TIME_LEADER_KEY)).toBeNull();
    expect(tabB.tryAcquire('user-1')).toBe(true);
  });

  it('does not let a tab release a lock it does not hold', () => {
    const tabA = createStudyTimeLeader('tab-a');
    const tabB = createStudyTimeLeader('tab-b');
    tabA.tryAcquire('user-1');

    tabB.release();

    expect(tabA.isLeader()).toBe(true);
  });

  // A lock left by a DIFFERENT account must not stall the tab in use. Two
  // accounts in two tabs is still one human; the server's ceiling is per user.
  it('steals a lock held for another account', () => {
    const tabA = createStudyTimeLeader('tab-a');
    const tabB = createStudyTimeLeader('tab-b');
    tabA.tryAcquire('user-1');

    expect(tabB.tryAcquire('user-2')).toBe(true);
  });

  it('survives a corrupt lock value', () => {
    localStorage.setItem(STUDY_TIME_LEADER_KEY, 'not-json');
    const tabA = createStudyTimeLeader('tab-a');

    expect(tabA.tryAcquire('user-1')).toBe(true);
  });

  it('never stores anything but the lock', () => {
    const tabA = createStudyTimeLeader('tab-a');
    tabA.tryAcquire('user-1');

    // Buffered study seconds must NEVER reach storage: they are not
    // authoritative, and a value another tab could read is a replay waiting to
    // happen.
    expect(Object.keys(localStorage)).toEqual([STUDY_TIME_LEADER_KEY]);
    const lock = JSON.parse(
      localStorage.getItem(STUDY_TIME_LEADER_KEY) as string,
    ) as Record<string, unknown>;
    expect(Object.keys(lock).sort()).toEqual(['expiresAt', 'tabId', 'userId']);
  });
});
