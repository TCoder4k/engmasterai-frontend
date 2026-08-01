import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 10 — XP, levels and achievements.
//
// Everything here is computed by the server from the XpTransaction ledger. The
// client never decides what an action is worth, never sends an amount, and
// never adds XP up itself — there is no write endpoint to call even if it
// wanted to.
//
// WHY THIS IS NOT READ FROM `localStorage('user')`. authService stores the user
// object at login and never refreshes it, so `user.totalPoints` is a snapshot
// frozen at sign-in. Rendering the level widget from it would show a number
// that never moves until the student logs out and back in — which reads as a
// broken feature rather than as stale data.

export type AchievementKey =
  | 'FIRST_STAGE'
  | 'FIRST_QUIZ_PASS'
  | 'FIRST_MASTERED_WORD'
  | 'STREAK_3'
  | 'STREAK_7'
  | 'XP_500';

export interface LevelProgress {
  /** Lifetime XP. */
  totalXp: number;
  level: number;
  /** XP earned since reaching `level`. */
  intoLevel: number;
  /** XP still needed for the next level. The curve has no cap. */
  toNextLevel: number;
  /** 0-100, floored server-side so a nearly-full bar never reads 100. */
  percent: number;
}

export interface Achievement {
  key: AchievementKey;
  xp: number;
  /** ISO timestamp, or null while still locked. */
  unlockedAt: string | null;
  /** Only for locked, countable badges. Streak badges carry null. */
  progress: { current: number; target: number } | null;
}

export interface GamificationProfile {
  xp: LevelProgress;
  /** The whole catalog, always six entries, locked ones included. */
  achievements: Achievement[];
  /** Next streak length worth chasing, or null once both are held. */
  nextMilestoneDays: number | null;
}

/**
 * What a single learning action just earned.
 *
 * Returned as a SIBLING field by the write endpoints (quiz submit, step
 * complete, trap answer, SRS review), never as part of the body those
 * endpoints persist — so replaying a request reports `xpAwarded: 0` rather
 * than re-announcing an award that already happened.
 */
export interface GamificationResult {
  xpAwarded: number;
  /**
   * The FULL level state after the action — the same five fields
   * GET /gamification/profile returns under `xp`, so a caller can drop it
   * straight into the cached profile.
   *
   * It carries `percent`, `intoLevel` and `toNextLevel` and not just the new
   * total for one reason: those three are what the level widget draws, and the
   * only other way to obtain them is a second copy of the XP curve here. Sprint
   * 10 QA found the widget frozen at its sign-in values because this used to be
   * `totalXp` + `level` alone.
   */
  xp: LevelProgress;
  leveledUp: boolean;
  unlockedAchievements: AchievementKey[];
}

/** Any write response that may carry an award beside its own payload. */
export type WithGamification<T> = T & { gamification?: GamificationResult };

// GET /gamification/profile
//
// Called ONCE per session by GamificationProvider, not once per page: the
// widget it feeds is rendered by StudentLayout on every student route, so a
// per-page fetch would put a request on every single navigation.
export const getGamificationProfile = async (): Promise<GamificationProfile> => {
  const response = await apiFetch(`${API_BASE_URL}/gamification/profile`);
  if (!response.ok) {
    return throwApiError(response, 'Failed to load gamification profile');
  }
  return response.json();
};

// --- award notifications ----------------------------------------------------
//
// A module-level publisher, subscribed to by GamificationProvider.
//
// WHY NOT PROP-DRILL. Awards come back from five different endpoints, consumed
// by the lesson player, the trap stage, the practice stage and the review
// session — components that share no ancestor below the router. Threading a
// callback to all of them would touch a dozen files for a side effect none of
// them care about, and every future award site would have to remember to do it
// too. Publishing at the SERVICE boundary means a response carrying
// `gamification` updates the level widget wherever it was triggered from.
//
// Same shape as RefreshCoordinator (services/refreshCoordinator.ts): a small
// module singleton, not a state library.
type AwardListener = (result: GamificationResult) => void;

const listeners = new Set<AwardListener>();

/** Subscribe. Returns the unsubscribe function. */
export const onGamificationAward = (listener: AwardListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Announce whatever a write endpoint just reported.
 *
 * Called by the learning services on every award-bearing response — including
 * the ones worth nothing, which are filtered here rather than at each call
 * site. A replayed submit reports `xpAwarded: 0` and must move nothing on
 * screen; that is the whole reason the server bothers to distinguish them.
 */
export const publishGamificationResult = (
  result: GamificationResult | undefined,
): void => {
  if (!result) return;
  if (result.xpAwarded === 0 && result.unlockedAchievements.length === 0) return;
  // A listener that throws must never break the learning action that produced
  // the award — the toast is the least important thing on screen.
  listeners.forEach((listener) => {
    try {
      listener(result);
    } catch {
      // ignored on purpose
    }
  });
};
