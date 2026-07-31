import React from 'react';
import { Flame, Target, TrendingUp, Trophy } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { DashboardAnalytics } from '../../services/analyticsService';
import { MOCK_ACHIEVEMENTS, MOCK_DAILY_GOAL } from './dashboardContent';
import { DEFAULT_DAILY_TARGETS, targetPercent } from './dailyTargets';

// Dashboard stat widgets, restyled to `ai-studio-dashboard-reference`'s
// DashboardView.
//
// SPRINT 09 — two of these four are now REAL. Today's Progress and the weekly
// streak come from GET /analytics/dashboard, server-derived from the same rows
// the learning engines write. Daily Goal and Achievements are still placeholder
// (no time tracking, no goal system, no achievements system) and keep their
// "sample data" markers — the markers were removed from the two that became
// real, because a "sample data" label on a true figure is its own kind of lie.
//
// LOADING AND ERROR ARE STATES, NOT ZEROS. This follows the rule Sprint 08
// established for course progress: a failed request must never render as "you
// did nothing today". On a student who studied all morning that is not an empty
// state, it is a false statement. `analytics === undefined` means in flight,
// `null` means the request failed, and only a real payload produces numbers.
//
// Renders as a single column in the desktop right rail, and as a 2-up grid on
// tablets when it flows below the main content.

interface UserSidebarProps {
  /** undefined = loading, null = failed, object = loaded. */
  analytics?: DashboardAnalytics | null;
  onRetryAnalytics?: () => void;
}

const WidgetCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, trailing, children }) => (
  // Labelled group: each widget is an independently meaningful chunk, so a
  // screen-reader user can move between them and always know which set of
  // numbers they are in. It also gives tests a stable handle, which matters
  // here because several widgets legitimately contain the same words.
  <section
    aria-label={title}
    className="p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-3xl shadow-sm dark:shadow-xl space-y-4"
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate">
          {title}
        </span>
      </div>
      {trailing}
    </div>
    {children}
  </section>
);

const StatSkeleton: React.FC = () => (
  <div className="space-y-3 pt-1" aria-hidden="true">
    {[0, 1, 2].map((row) => (
      <div key={row} className="flex items-center justify-between gap-3">
        <span className="h-3 w-24 rounded-full bg-slate-100 dark:bg-ink-950 animate-pulse" />
        <span className="h-4 w-8 rounded-full bg-slate-100 dark:bg-ink-950 animate-pulse" />
      </div>
    ))}
  </div>
);

const StatsError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">
        {t.widgets.statsUnavailable}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.widgets.statsRetry}
        </button>
      )}
    </div>
  );
};

// The activity window is a ROLLING seven days ending today, not a Monday-Sunday
// week, so the weekday label has to come from each date rather than from a
// fixed array position. Parsed into a local Date from its parts: `new
// Date('2026-07-31')` is UTC midnight, which reads as the previous day for
// anyone west of Greenwich — the same class of bug this sprint fixed on the
// server.
const weekdayIndex = (isoDate: string): number => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const local = new Date(year, month - 1, day);
  return (local.getDay() + 6) % 7; // 0 = Monday, matching t.widgets.weekDays
};

const UserSidebar: React.FC<UserSidebarProps> = ({
  analytics,
  onRetryAnalytics,
}) => {
  const { t } = useTranslation();

  const { targetMinutes, learnedMinutes } = MOCK_DAILY_GOAL;
  const dailyPercent = Math.round((learnedMinutes / targetMinutes) * 100);

  // Circumference of the r=26 ring the reference uses.
  const ringLength = 2 * Math.PI * 26;

  const isLoading = analytics === undefined;
  const hasFailed = analytics === null;

  // The VALUE of each row is server-derived; the TARGET is a product default
  // (see dailyTargets.ts for why that distinction makes the bar honest).
  const todayRows = analytics
    ? [
        {
          key: 'stagesDone',
          label: t.widgets.stagesDone,
          value: analytics.today.stagesCompleted,
          target: DEFAULT_DAILY_TARGETS.stagesCompleted,
          barClass: 'bg-blue-500',
          textClass: 'text-blue-500 dark:text-blue-400',
        },
        {
          key: 'attempts',
          label: t.widgets.attempts,
          value: analytics.today.taskAttempts.total,
          target: DEFAULT_DAILY_TARGETS.taskAttempts,
          barClass: 'bg-cyan-500',
          textClass: 'text-cyan-500 dark:text-cyan-400',
        },
        {
          key: 'newWords',
          label: t.widgets.newWords,
          value: analytics.today.newWordsLearned,
          target: DEFAULT_DAILY_TARGETS.newWordsLearned,
          barClass: 'bg-emerald-500',
          textClass: 'text-emerald-500 dark:text-emerald-400',
        },
        {
          key: 'wordsReviewed',
          label: t.widgets.wordsReviewed,
          value: analytics.today.wordsReviewed,
          target: DEFAULT_DAILY_TARGETS.wordsReviewed,
          barClass: 'bg-violet-500',
          textClass: 'text-violet-500 dark:text-violet-400',
        },
      ]
    : [];

  const streakDays = analytics?.activity.currentStreakDays ?? null;

  return (
    <aside className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6">
      <WidgetCard
        icon={<Target className="w-4 h-4 text-blue-500 dark:text-blue-400" aria-hidden="true" />}
        title={t.widgets.dailyGoal}
        trailing={
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">{dailyPercent}%</span>
        }
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              {targetMinutes} {t.widgets.minutesShort}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {learnedMinutes} / {targetMinutes} {t.widgets.minutesLearned}
            </p>
          </div>

          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center" aria-hidden="true">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="26"
                strokeWidth="6"
                fill="transparent"
                className="stroke-slate-100 dark:stroke-ink-950"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="url(#dailyGoalGradient)"
                strokeWidth="6"
                strokeDasharray={ringLength}
                strokeDashoffset={ringLength - (ringLength * dailyPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
              <defs>
                <linearGradient id="dailyGoalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-xs font-black text-slate-900 dark:text-white">
              {dailyPercent}%
            </span>
          </div>
        </div>

        <div className="w-full h-2 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-ink-700">
          <div
            style={{ width: `${dailyPercent}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
          />
        </div>
        {/* Still placeholder — there is no time tracking and no goal system. */}
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {t.widgets.sampleData}
        </p>
      </WidgetCard>

      {/* ---- REAL: rolling seven-day activity and streak ---- */}
      <WidgetCard
        icon={<Flame className="w-4 h-4 text-amber-500 fill-amber-400" aria-hidden="true" />}
        title={t.widgets.weeklyStreak}
        trailing={
          streakDays !== null ? (
            <span className="text-xs font-black text-amber-500 dark:text-amber-400">
              {streakDays}
              {analytics?.activity.streakCapped ? '+' : ''} {t.widgets.days}
            </span>
          ) : undefined
        }
      >
        {isLoading && <StatSkeleton />}
        {hasFailed && <StatsError onRetry={onRetryAnalytics} />}

        {analytics && (
          <>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {streakDays}
              {analytics.activity.streakCapped ? '+' : ''} {t.widgets.days}{' '}
              {streakDays !== null && streakDays > 0 && (
                <span className="text-xs font-bold text-amber-500 dark:text-amber-400">
                  🔥 {t.widgets.onFire}
                </span>
              )}
            </p>

            <ul className="flex items-center justify-between gap-1 pt-1 list-none">
              {analytics.activity.days.map((day) => (
                <li key={day.date} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                      day.active
                        ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-black shadow-lg shadow-amber-500/20'
                        : 'bg-slate-100 dark:bg-ink-950 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-ink-700'
                    }`}
                    // The tick is decorative; the date and its state are carried
                    // by the label below plus this title, so activity is never
                    // signalled by colour alone.
                    title={day.date}
                  >
                    {day.active ? '✓' : t.widgets.weekDays[weekdayIndex(day.date)]}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {t.widgets.weekDays[weekdayIndex(day.date)]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </WidgetCard>

      {/* ---- REAL: today's counts ---- */}
      <WidgetCard
        icon={<TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />}
        title={t.widgets.todaysProgress}
      >
        {isLoading && <StatSkeleton />}
        {hasFailed && <StatsError onRetry={onRetryAnalytics} />}

        {analytics && (
          <dl className="space-y-3 pt-1">
            {todayRows.map((row) => {
              const percent = targetPercent(row.value, row.target);
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs font-bold">
                    <dt className="text-slate-500 dark:text-slate-400">{row.label}</dt>
                    <dd className={`${row.textClass} tabular-nums`}>
                      {row.value} / {row.target}
                    </dd>
                  </div>
                  <div
                    className="w-full h-2 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden border border-slate-200 dark:border-ink-700"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={row.label}
                  >
                    {/* Width is clamped to 100 so beating the target fills the
                        track rather than overflowing it; the raw count beside it
                        still shows the real figure (e.g. 30 / 20). */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${row.barClass}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </dl>
        )}
      </WidgetCard>

      <WidgetCard
        icon={<Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />}
        title={t.widgets.achievements}
        trailing={
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            {t.widgets.sampleData}
          </span>
        }
      >
        <ul className="space-y-3">
          {MOCK_ACHIEVEMENTS.map((achievement) => (
            <li
              key={achievement.titleKey}
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-ink-700 rounded-2xl"
            >
              <span
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 font-black text-xs ${achievement.tileClass}`}
                aria-hidden="true"
              >
                {achievement.glyph}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  {t.widgets[achievement.titleKey]}
                </span>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                  {t.widgets[`${achievement.titleKey}Hint` as const]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </WidgetCard>
    </aside>
  );
};

export default UserSidebar;
