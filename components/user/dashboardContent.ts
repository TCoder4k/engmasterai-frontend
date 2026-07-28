// Dashboard values that have NO data source yet.
//
// ⚠️ PLACEHOLDER NUMBERS — NOT THIS STUDENT'S DATA. ⚠️
//
// The dashboard was rebuilt to match `ai-studio-dashboard-reference/`'s
// DashboardView at the product owner's request. Most of that design's
// numbers are now real (lesson/deck/segment counts, the Continue Learning
// progress bar, due-word counts — see UserHome), but four widgets and the
// course star ratings have nothing behind them: there is no time-tracking,
// no streak record, no per-day activity log, no achievements system and no
// course-rating feature anywhere in this product.
//
// They live in one module so that, when any of those systems lands, the
// wiring is a single obvious file to delete from — and so nobody mistakes
// these for values the app computed. Everything here is identical for every
// user on every day, which is the tell.

export interface DailyGoal {
  targetMinutes: number;
  learnedMinutes: number;
}

export interface TodayProgressRow {
  /** Translation key under `t.widgets`. */
  labelKey: 'lessons' | 'practice' | 'newWords';
  done: number;
  target: number;
  /** Tailwind text + bar colours, matching the reference's three rows. */
  textClass: string;
  barClass: string;
}

export interface Achievement {
  /** Rendered inside the badge tile — an emoji or a short number. */
  glyph: string;
  titleKey: 'firstLesson' | 'weekStreak' | 'hundredWords';
  tileClass: string;
}

export const MOCK_DAILY_GOAL: DailyGoal = { targetMinutes: 30, learnedMinutes: 18 };

/** Monday-first, matching `t.widgets.weekDays`. */
export const MOCK_STREAK_DAYS: boolean[] = [true, true, true, true, true, true, false];

export const MOCK_TODAY_PROGRESS: TodayProgressRow[] = [
  {
    labelKey: 'lessons',
    done: 2,
    target: 5,
    textClass: 'text-blue-500 dark:text-blue-400',
    barClass: 'bg-blue-500',
  },
  {
    labelKey: 'practice',
    done: 1,
    target: 3,
    textClass: 'text-cyan-500 dark:text-cyan-400',
    barClass: 'bg-cyan-500',
  },
  {
    labelKey: 'newWords',
    done: 15,
    target: 20,
    textClass: 'text-emerald-500 dark:text-emerald-400',
    barClass: 'bg-emerald-500',
  },
];

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    glyph: '⭐',
    titleKey: 'firstLesson',
    tileClass:
      'bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30',
  },
  {
    glyph: '7',
    titleKey: 'weekStreak',
    tileClass:
      'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  {
    glyph: '100',
    titleKey: 'hundredWords',
    tileClass:
      'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  },
];

// Star ratings for the "Recommended for You" cards. Derived from the course
// id so a given course always shows the same figure — a rating that changed
// on every render would read as broken rather than as data. It is still a
// placeholder: no rating feature exists.
export interface MockRating {
  score: string;
  count: string;
}

const RATINGS: MockRating[] = [
  { score: '4.8', count: '892' },
  { score: '4.9', count: '1.2k' },
  { score: '4.7', count: '754' },
  { score: '4.9', count: '1.5k' },
  { score: '4.6', count: '318' },
];

export const mockRatingFor = (courseId: string): MockRating => {
  let sum = 0;
  for (let index = 0; index < courseId.length; index += 1) sum += courseId.charCodeAt(index);
  return RATINGS[sum % RATINGS.length];
};
