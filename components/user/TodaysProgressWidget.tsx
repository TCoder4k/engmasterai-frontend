import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { DashboardAnalytics } from '../../services/analyticsService';
import { WidgetCard, StatSkeleton, StatsError } from './UserSidebar';
import { DEFAULT_DAILY_TARGETS, targetPercent } from './dailyTargets';

interface TodaysProgressWidgetProps {
  /** undefined = loading, null = failed, object = loaded — same three-state
   * contract as UserSidebar's own analytics-backed widgets. */
  analytics?: DashboardAnalytics | null;
  onRetryAnalytics?: () => void;
  compact?: boolean;
}

const TodaysProgressWidget: React.FC<TodaysProgressWidgetProps> = ({
  analytics,
  onRetryAnalytics,
  compact = false,
}) => {
  const { t } = useTranslation();

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

  return (
    <WidgetCard
      compact={compact}
      icon={<TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
      iconTileClass="bg-emerald-100 dark:bg-emerald-500/15"
      title={t.widgets.todaysProgress}
    >
      {isLoading && <StatSkeleton />}
      {hasFailed && <StatsError onRetry={onRetryAnalytics} />}

      {analytics && (
        <dl className={`${compact ? 'space-y-2.5' : 'space-y-3'} pt-1`}>
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
                  className={`${compact ? 'h-1.5' : 'h-2'} w-full bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden border border-slate-200 dark:border-ink-700`}
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
  );
};

export default TodaysProgressWidget;
