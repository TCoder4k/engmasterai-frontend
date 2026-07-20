import React from 'react';
import { Target, Flame, BarChart3, Trophy } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// Dashboard stat widgets — all in honest empty/preview states: there is no
// daily-goal, streak, per-day progress, or achievements backend yet, so no
// numbers are fabricated. Widgets whose data will exist per-user later show
// "No data yet"; features that don't exist at all show "Coming soon". When
// those systems land (Vocabulary Phases 3–5), each widget gets wired here.
//
// Renders as a single column in the desktop right rail, and as a 2-up grid on
// tablets when it flows below the main content.

const WidgetCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
    <div className="flex items-center space-x-2">
      {icon}
      <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{title}</p>
    </div>
    {children}
  </div>
);

const UserSidebar: React.FC = () => {
  const { t } = useTranslation();

  const progressRows = [t.widgets.lessons, t.widgets.practice, t.widgets.newWords];

  return (
    <aside className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
      {/* Daily Goal — empty ring, no fabricated minutes/percent */}
      <WidgetCard
        icon={<Target size={17} className="text-slate-700 dark:text-slate-300" aria-hidden="true" />}
        title={t.widgets.dailyGoal}
      >
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t.common.noDataYet}</p>
          <div className="relative w-14 h-14 flex-shrink-0" aria-hidden="true">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3.5"
                className="stroke-slate-100 dark:stroke-slate-800"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-slate-300 dark:text-slate-600">
              —
            </span>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2" />
      </WidgetCard>

      {/* Weekly Streak — day circles all unfilled, no fabricated streak count */}
      <WidgetCard
        icon={<Flame size={17} className="text-orange-500 fill-orange-400" aria-hidden="true" />}
        title={t.widgets.weeklyStreak}
      >
        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-3 mb-4">
          {t.common.noDataYet}
        </p>
        <div className="flex items-center justify-between" aria-hidden="true">
          {t.widgets.weekDays.map((day, index) => (
            <div key={index} className="flex flex-col items-center space-y-1.5">
              <span className="w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{day}</span>
            </div>
          ))}
        </div>
      </WidgetCard>

      {/* Today's Progress — labeled rows with empty tracks, no invented counts */}
      <WidgetCard
        icon={<BarChart3 size={17} className="text-indigo-500 dark:text-indigo-400" aria-hidden="true" />}
        title={t.widgets.todaysProgress}
      >
        <div className="space-y-4 mt-4">
          {progressRows.map((label) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                <span className="text-[13px] font-bold text-slate-300 dark:text-slate-600">—</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full" />
            </div>
          ))}
        </div>
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-3">
          {t.common.noDataYet}
        </p>
      </WidgetCard>

      {/* Achievements — feature doesn't exist yet; no fabricated badge list */}
      <WidgetCard
        icon={<Trophy size={17} className="text-amber-500" aria-hidden="true" />}
        title={t.widgets.achievements}
      >
        <div className="flex flex-col items-center text-center py-5">
          <Trophy size={26} className="text-slate-200 dark:text-slate-700 mb-2" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t.common.comingSoon}</p>
        </div>
      </WidgetCard>
    </aside>
  );
};

export default UserSidebar;
