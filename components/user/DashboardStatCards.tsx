import React from 'react';
import { BookMarked, Target, CheckCircle2 } from 'lucide-react';
import { DashboardAnalytics } from '../../services/analyticsService';
import { useTranslation } from '../../i18n/useTranslation';

interface DashboardStatCardsProps {
  /** null = not yet known (still loading, or the supplementary fetch failed). */
  masteredWords: number | null;
  /** undefined = loading, null = the analytics request failed. */
  analytics: DashboardAnalytics | null | undefined;
  /** null = progress summaries not yet loaded. */
  totalCompletedLessons: number | null;
  /** null = not yet known, OR the student has no roadmap — both render as no subtitle, matching ReviewDueCard's own tertiary-stat convention. */
  roadmapCompletionPercent: number | null;
}

interface StatTileProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconTileClass: string;
  label: string;
  // undefined = loading (skeleton), null = resolved but unavailable (dash),
  // string = the real value.
  value: string | null | undefined;
  subtitle: string | null;
}

const StatTile: React.FC<StatTileProps> = ({
  icon: Icon,
  iconTileClass,
  label,
  value,
  subtitle,
}) => {
  return (
    <div className="snap-start min-w-[150px] md:min-w-0 rounded-2xl border border-slate-100 dark:border-ink-700 bg-white dark:bg-ink-900 p-3 md:p-4 space-y-3">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconTileClass}`}
          aria-hidden="true"
        >
          <Icon size={16} />
        </div>
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide truncate">
          {label}
        </p>
      </div>

      <div>
        {value === undefined ? (
          <div
            className="h-7 w-16 bg-slate-100 dark:bg-ink-800 rounded animate-pulse"
            aria-hidden="true"
          />
        ) : (
          <p className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {value ?? '—'}
          </p>
        )}
        {subtitle && (
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

// Dashboard redesign — 3 real stat cards under the vocabulary CTA. Each
// carries its OWN loading/unavailable state, independent of the others,
// matching every other supplementary widget on this page (RoadmapCard,
// UserSidebar): a slow or failed source degrades just its own tile, never
// blocks the rest of the row.
const DashboardStatCards: React.FC<DashboardStatCardsProps> = ({
  masteredWords,
  analytics,
  totalCompletedLessons,
  roadmapCompletionPercent,
}) => {
  const copy = useTranslation().t.dashboard.statCards;

  const accuracyValue: string | null | undefined =
    analytics === undefined
      ? undefined
      : analytics === null || analytics.recentAccuracyPercent === null
        ? null
        : `${analytics.recentAccuracyPercent}%`;

  return (
    // Horizontal snap carousel below md (768px) — a static 3-col grid at
    // 640px measured too tight for the full Vietnamese labels (confirmed via
    // screenshot: "TỪ ĐÃ THÀNH THẠO" truncates at 640px, fits cleanly at
    // 768px), so each tile gets its own scrollable lane instead of a
    // squeezed 1/3 column. Reverts to the existing static grid from md up.
    <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 -mx-4 px-4 pb-1 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:gap-3">
      <StatTile
        icon={BookMarked}
        iconTileClass="bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400"
        label={copy.masteredWordsLabel}
        value={masteredWords === null ? undefined : String(masteredWords)}
        subtitle={null}
      />
      <StatTile
        icon={Target}
        iconTileClass="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        label={copy.accuracyLabel}
        value={accuracyValue}
        subtitle={null}
      />
      <StatTile
        icon={CheckCircle2}
        iconTileClass="bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
        label={copy.completedLessonsLabel}
        value={totalCompletedLessons === null ? undefined : String(totalCompletedLessons)}
        subtitle={roadmapCompletionPercent !== null ? copy.roadmapPercent(roadmapCompletionPercent) : null}
      />
    </div>
  );
};

export default DashboardStatCards;
