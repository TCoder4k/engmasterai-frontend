// Dashboard values that have NO data source yet.
//
// ⚠️ PLACEHOLDER NUMBERS — NOT THIS STUDENT'S DATA. ⚠️
//
// The dashboard was rebuilt to match `ai-studio-dashboard-reference/`'s
// DashboardView at the product owner's request. Most of that design's numbers
// are real, and SPRINT 09 converted two more widgets — Today's Progress and
// the weekly streak — to server-derived figures from GET /analytics/dashboard.
//
// What is left here has genuinely nothing behind it: there is no time-tracking
// and no goal system (Daily Goal), no achievements system, and no course-rating
// feature anywhere in this product.
//
// They live in one module so that, when any of those systems lands, the wiring
// is a single obvious file to delete from — and so nobody mistakes these for
// values the app computed. Everything here is identical for every user on every
// day, which is the tell.
//
// SPRINT 09 REMOVED `MOCK_TODAY_PROGRESS` and `MOCK_STREAK_DAYS`. Do not
// reintroduce a placeholder beside the real widget: a fabricated number sitting
// next to a true one is worse than an empty state, because nothing on screen
// distinguishes them.

export interface DailyGoal {
  targetMinutes: number;
  learnedMinutes: number;
}

// Still placeholder: study TIME is not tracked anywhere. Quiz and practice
// attempts carry a durationSeconds, but theory, video and listening contribute
// nothing, so a "minutes studied" figure would be missing most of its input —
// a wrong number rather than an approximate one. Sprint 09 deliberately shipped
// no minutes metric rather than a misleading one.
export const MOCK_DAILY_GOAL: DailyGoal = { targetMinutes: 30, learnedMinutes: 18 };

// SPRINT 10 REMOVED `MOCK_ACHIEVEMENTS`. Achievements are real now — six
// server-defined badges from GET /gamification/profile, rendered by
// components/user/AchievementsWidget.tsx. Do not reintroduce a placeholder
// beside a real widget.

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
