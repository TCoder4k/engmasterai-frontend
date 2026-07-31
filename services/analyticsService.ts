import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 09 — the dashboard's analytics read, and the only one.
//
// Sprint 07 put progress on the server and Sprint 08 put the completion RULE
// there, but both answer "what is the state now". Nothing answered "what
// happened today", which is why four dashboard widgets were hardcoded sample
// data. This carries that answer across the wire and derives nothing: every
// number below is computed by the server from rows the learning engines write.

export interface TodayTaskAttempts {
  quiz: number;
  practice: number;
  total: number;
}

export interface TodayAnalytics {
  /** 'YYYY-MM-DD' in the effective timezone. */
  date: string;
  /**
   * Learning stages finished today, across EVERY module — not lessons, and not
   * Grammar-only. A lesson spans several days, so counting lessons would show a
   * hard-working student a zero; a stage is the unit of work actually done.
   */
  stagesCompleted: number;
  /** Attempts submitted, not attempts passed — failing twice is still work. */
  taskAttempts: TodayTaskAttempts;
  newWordsLearned: number;
  wordsReviewed: number;
}

export interface ActivityDay {
  date: string;
  active: boolean;
}

export interface ActivityAnalytics {
  windowDays: number;
  /** Ascending, `windowDays` long, last element is today. */
  days: ActivityDay[];
  currentStreakDays: number;
  /** Every day in the window is active, so the real streak may be longer. */
  streakCapped: boolean;
}

export interface DashboardAnalytics {
  effectiveTimeZone: string;
  today: TodayAnalytics;
  activity: ActivityAnalytics;
}

// GET /analytics/dashboard
//
// `tz` is sent on every call. The server uses it to bucket days for THIS read
// (so a student who has never opened vocabulary review still gets their own
// midnight rather than UTC's) and, separately, to seed User.timezone the first
// time that column is null.
export const getDashboardAnalytics = async (): Promise<DashboardAnalytics> => {
  const params = new URLSearchParams({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const response = await apiFetch(
    `${API_BASE_URL}/analytics/dashboard?${params}`,
  );
  if (!response.ok) {
    return throwApiError(response, 'Failed to load dashboard analytics');
  }
  return response.json();
};
