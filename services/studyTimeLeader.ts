import { newUuidV4 } from './clientSessionId';

// Sprint 10.5 — which browser tab is allowed to credit study seconds.
//
// THE PROBLEM. Two tabs open on learning pages are one student, not two. Both
// would tick, both would flush, and the day's minutes would double. The server's
// convergence cap bounds the damage but does not remove it, and it should not
// have to: within one browser this is cheaply and exactly solvable.
//
// THE RULE THAT MATTERS: ONLY A TAB THAT IS ACTUALLY STUDYING MAY HOLD THE LOCK.
//
// An earlier design let any tab claim it. That breaks the single most common
// arrangement in this app: /home open in one tab, a lesson in another. The
// /home tab would win the lock, contribute nothing (it registers no activity),
// and the tab doing the actual studying would be locked out — the student
// earns zero. `tryAcquire` is therefore only ever called from a tick that has
// already found an active activity, and `release` is called the moment the last
// one unregisters.
//
// LOCALSTORAGE HOLDS THE LOCK AND NOTHING ELSE. Buffered seconds never touch
// storage: they are not authoritative, they must not survive a crash into a
// later session, and a value another tab could read and re-send is a replay
// waiting to happen. The lock is safe there precisely because it is
// self-invalidating — a lease with an expiry, not a fact.

export const STUDY_TIME_LEADER_KEY = 'engmasterai:studyTimeLeader';

/** How long a claim survives without renewal. */
export const LEADER_TTL_MS = 15_000;

interface LeaderLock {
  tabId: string;
  userId: string;
  expiresAt: number;
}

const readLock = (): LeaderLock | null => {
  try {
    const raw = localStorage.getItem(STUDY_TIME_LEADER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LeaderLock>;
    if (
      typeof parsed?.tabId !== 'string' ||
      typeof parsed?.userId !== 'string' ||
      typeof parsed?.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed as LeaderLock;
  } catch {
    // Corrupt or unreadable (private mode, quota, hand-edited). Treat as
    // "nobody holds it" — the worst case is two tabs ticking, which the
    // server's cap already bounds.
    return null;
  }
};

const writeLock = (lock: LeaderLock): void => {
  try {
    localStorage.setItem(STUDY_TIME_LEADER_KEY, JSON.stringify(lock));
  } catch {
    // Storage unavailable. Carry on unlocked rather than stopping tracking.
  }
};

export interface StudyTimeLeader {
  readonly tabId: string;
  /**
   * Claim or renew the lock for `userId`.
   *
   * MUST ONLY BE CALLED BY A TAB WITH AN ACTIVE LEARNING ACTIVITY — see the
   * note above; calling it speculatively is the bug this design exists to
   * prevent.
   */
  tryAcquire(userId: string): boolean;
  /** Give up the lock if we hold it. Safe to call when we do not. */
  release(): void;
  /** Whether this tab currently holds an unexpired lock. */
  isLeader(): boolean;
}

export const createStudyTimeLeader = (
  tabId: string = newUuidV4(),
): StudyTimeLeader => ({
  tabId,

  tryAcquire(userId: string): boolean {
    const now = Date.now();
    const lock = readLock();

    const claimable =
      lock === null ||
      lock.tabId === tabId ||
      lock.expiresAt <= now ||
      // A lock held for a DIFFERENT account is not ours to wait for. Two
      // accounts signed in to two tabs of one browser is still one human, and
      // leaving a foreign lease to expire would stall the tab that is actually
      // being used. They alternate; each gets a share; neither is inflated,
      // because the server's ceiling is per user.
      lock.userId !== userId;

    if (!claimable) return false;

    writeLock({ tabId, userId, expiresAt: now + LEADER_TTL_MS });
    return true;
  },

  release(): void {
    const lock = readLock();
    if (lock && lock.tabId !== tabId) return;
    try {
      localStorage.removeItem(STUDY_TIME_LEADER_KEY);
    } catch {
      // Nothing to do; the lease expires on its own.
    }
  },

  isLeader(): boolean {
    const lock = readLock();
    return lock !== null && lock.tabId === tabId && lock.expiresAt > Date.now();
  },
});

/** The lock for this document. One per tab, created at module load. */
export const studyTimeLeader = createStudyTimeLeader();
