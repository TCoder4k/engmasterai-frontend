import React from 'react';
import { Flame, Target, TrendingUp, Trophy } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import {
  MOCK_ACHIEVEMENTS,
  MOCK_DAILY_GOAL,
  MOCK_STREAK_DAYS,
  MOCK_TODAY_PROGRESS,
} from './dashboardContent';

// Dashboard stat widgets, restyled to `ai-studio-dashboard-reference`'s
// DashboardView.
//
// ⚠️ Every number in this file is PLACEHOLDER data — there is still no
// time-tracking, streak record, per-day activity log or achievements system
// behind any of these four widgets. They previously rendered honest empty
// states; the product owner asked for the reference's filled-in look, so the
// values now come from components/user/dashboardContent.ts, which is the one
// file to rewire when those systems land. Each card carries a small
// "sample data" marker so a student is not told these are their own figures.
//
// Renders as a single column in the desktop right rail, and as a 2-up grid on
// tablets when it flows below the main content.

const WidgetCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, trailing, children }) => (
  <div className="p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-3xl shadow-sm dark:shadow-xl space-y-4">
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
  </div>
);

const UserSidebar: React.FC = () => {
  const { t } = useTranslation();

  const { targetMinutes, learnedMinutes } = MOCK_DAILY_GOAL;
  const dailyPercent = Math.round((learnedMinutes / targetMinutes) * 100);
  const streakCount = MOCK_STREAK_DAYS.filter(Boolean).length;

  // Circumference of the r=26 ring the reference uses.
  const ringLength = 2 * Math.PI * 26;

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
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {t.widgets.sampleData}
        </p>
      </WidgetCard>

      <WidgetCard
        icon={<Flame className="w-4 h-4 text-amber-500 fill-amber-400" aria-hidden="true" />}
        title={t.widgets.weeklyStreak}
        trailing={
          <span className="text-xs font-black text-amber-500 dark:text-amber-400">
            {streakCount} {t.widgets.days}
          </span>
        }
      >
        <p className="text-2xl font-black text-slate-900 dark:text-white">
          {streakCount} {t.widgets.days}{' '}
          <span className="text-xs font-bold text-amber-500 dark:text-amber-400">
            🔥 {t.widgets.onFire}
          </span>
        </p>

        <div className="flex items-center justify-between gap-1 pt-1" aria-hidden="true">
          {t.widgets.weekDays.map((day, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5">
              <span
                className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                  MOCK_STREAK_DAYS[index]
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-black shadow-lg shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-ink-950 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-ink-700'
                }`}
              >
                {MOCK_STREAK_DAYS[index] ? '✓' : day}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{day}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {t.widgets.sampleData}
        </p>
      </WidgetCard>

      <WidgetCard
        icon={<TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />}
        title={t.widgets.todaysProgress}
      >
        <div className="space-y-3 pt-1">
          {MOCK_TODAY_PROGRESS.map((row) => (
            <div key={row.labelKey} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">{t.widgets[row.labelKey]}</span>
                <span className={row.textClass}>
                  {row.done} / {row.target}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden border border-slate-200 dark:border-ink-700">
                <div
                  className={`h-full rounded-full ${row.barClass}`}
                  style={{ width: `${Math.round((row.done / row.target) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {t.widgets.sampleData}
        </p>
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
