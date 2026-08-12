import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Target, TrendingUp, Flame, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { LearningGoal } from '../../types';
import { RoadmapView, getPlacementRoadmap } from '../../services/placementService';
import {
  CourseProgressSummary,
  continuePath,
  getCourseProgressSummaries,
} from '../../services/courseProgressService';
import { getDashboardAnalytics } from '../../services/analyticsService';
import { statusPresentation } from '../../services/courseStatus';
import { ApiError, handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';
import { StringKeys, TranslationDict } from '../../i18n/translations';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';

interface RoadmapStepProps {
  onFinished: () => void;
}

// A fetch that hasn't resolved yet vs. one that failed are always kept
// distinct (never collapsed into one boolean) — same discipline
// RoadmapCard.tsx's LoadState follows on the dashboard, so a transient
// failure degrades quietly instead of getting stuck mid-state forever.
type AsyncState = 'loading' | 'ready' | 'error';

const GOAL_LABEL_KEY: Record<LearningGoal, StringKeys<TranslationDict['onboarding']>> = {
  FOUNDATION: 'goalFoundation',
  TOEIC_450: 'goalToeic450',
  TOEIC_650: 'goalToeic650',
  TOEIC_800: 'goalToeic800',
  GENERAL_ENGLISH: 'goalGeneralEnglish',
  REGULAR_PRACTICE: 'goalRegularPractice',
};

// The real "Engy" mascot artwork — same composition as the approved mockup's
// roadmap header (Engy at a laptop with a plant and a coffee mug), background
// removed so it sits on the card instead of carrying its own baked-in
// backdrop color. Its real, measured dimensions (730×342) drive the reserved
// container's aspect-ratio below, so the box is never a guess and never
// shifts layout on load.
const MASCOT_SRC = '/mascot/mascot2-transparent.png';
const MASCOT_ASPECT_RATIO = '730 / 342';

const COLLAPSED_PHASE_COUNT = 3;

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | null;
  state: AsyncState;
}

// Each stat owns its own loading/degrade state — never a shared
// "the whole screen is loading" flag. The roadmap itself (goal included)
// renders immediately from data RoadmapStep already has; only "Tiến độ hiện
// tại" and "Chuỗi ngày học" depend on the two extra requests below, and a
// failure in either never blocks or errors the rest of the page.
const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, state }) => (
  <div className="rounded-2xl border border-slate-100 dark:border-ink-700 p-4 flex items-center gap-3">
    <div
      className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
      aria-hidden="true"
    >
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate">{label}</p>
      {state === 'loading' ? (
        <div className="h-4 w-14 mt-1 bg-slate-100 dark:bg-ink-800 rounded animate-pulse" aria-hidden="true" />
      ) : (
        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{value ?? '—'}</p>
      )}
    </div>
  </div>
);

// Step 5 — the deterministic roadmap. Fetched fresh here (not passed down
// from an earlier step) because GET /placement/roadmap is the ONLY source
// for course title/thumbnail — those are joined against LIVE Course rows on
// every read, never a stored snapshot (see the backend's roadmap-algorithm.ts
// and placement.service.ts's getRoadmap).
const RoadmapStep: React.FC<RoadmapStepProps> = ({ onFinished }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState<RoadmapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // "Tiến độ hiện tại" (aggregate) and every phase card's lesson-count/
  // progress/status/action all come from this ONE batch call — the same
  // canonical read CourseCard/CourseDetailPage already use, not a new source
  // of truth. Loading/error here is entirely independent of the roadmap
  // fetch above and of the streak fetch below.
  const [progressSummaries, setProgressSummaries] = useState<Map<string, CourseProgressSummary> | null>(
    null,
  );
  const [progressState, setProgressState] = useState<AsyncState>('loading');

  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [streakState, setStreakState] = useState<AsyncState>('loading');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPlacementRoadmap()
      .then(setRoadmap)
      .catch((err) => {
        setError(
          err instanceof ApiError && err.status === 404
            ? t.onboarding.roadmapEmpty
            : handleAuthError(err, navigate) || t.onboarding.roadmapLoadFailed,
        );
      })
      .finally(() => setLoading(false));
  }, [navigate, t.onboarding.roadmapEmpty, t.onboarding.roadmapLoadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  // Fired alongside the roadmap fetch, not after it — but it needs the
  // roadmap's course ids, so it starts as soon as those exist.
  useEffect(() => {
    if (!roadmap || roadmap.items.length === 0) {
      setProgressState('ready');
      return;
    }
    let cancelled = false;
    setProgressState('loading');
    getCourseProgressSummaries(roadmap.items.map((item) => item.courseId))
      .then((summaries) => {
        if (cancelled) return;
        setProgressSummaries(summaries);
        setProgressState('ready');
      })
      .catch(() => {
        if (!cancelled) setProgressState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [roadmap]);

  // Independent of the roadmap fetch entirely — fires on mount.
  useEffect(() => {
    let cancelled = false;
    setStreakState('loading');
    getDashboardAnalytics()
      .then((analytics) => {
        if (cancelled) return;
        setStreakDays(analytics.activity.currentStreakDays);
        setStreakState('ready');
      })
      .catch(() => {
        if (!cancelled) setStreakState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const aggregateProgressPercent = useMemo(() => {
    if (!roadmap || progressState !== 'ready' || !progressSummaries) return null;
    let totalLessons = 0;
    let completedLessons = 0;
    for (const item of roadmap.items) {
      const summary = progressSummaries.get(item.courseId);
      if (!summary) continue;
      totalLessons += summary.totalLessons;
      completedLessons += summary.completedLessons;
    }
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  }, [roadmap, progressState, progressSummaries]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !roadmap) {
    return <ErrorState message={error ?? t.onboarding.roadmapLoadFailed} onRetry={load} />;
  }

  const showToggle = roadmap.items.length > COLLAPSED_PHASE_COUNT;
  const visibleItems =
    expanded || !showToggle ? roadmap.items : roadmap.items.slice(0, COLLAPSED_PHASE_COUNT);

  return (
    <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {t.onboarding.roadmapTitle}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.onboarding.roadmapSubtitle}</p>
        </div>
        {/* Reserved box sized from the asset's own real aspect ratio, so
            there is no layout shift whether the image is cached or still
            loading. object-contain (never cover) keeps the illustration's
            natural proportions exactly as authored — no stretch, crop, or
            recolor. Hidden below `sm` and capped by max-w-full so it can
            never overflow the card on narrow viewports or crowd the title/
            subtitle beside it. Purely decorative here — the heading and
            subtitle already carry the same information in text. */}
        <div
          className="hidden sm:block flex-shrink-0 w-40 md:w-48 lg:w-56 max-w-full overflow-hidden"
          style={{ aspectRatio: MASCOT_ASPECT_RATIO }}
        >
          <img
            src={MASCOT_SRC}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={Target}
          label={t.onboarding.roadmapStatGoal}
          value={t.onboarding[GOAL_LABEL_KEY[roadmap.goal]]}
          state="ready"
        />
        <StatCard
          icon={TrendingUp}
          label={t.onboarding.roadmapStatProgress}
          value={aggregateProgressPercent !== null ? `${aggregateProgressPercent}%` : null}
          state={progressState}
        />
        <StatCard
          icon={Flame}
          label={t.onboarding.roadmapStatStreak}
          value={streakDays !== null ? t.onboarding.roadmapStreakDays(streakDays) : null}
          state={streakState}
        />
      </div>

      {roadmap.items.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">
          {t.onboarding.roadmapEmpty}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {t.onboarding.roadmapPhasesHeading}
            </h2>
            {showToggle && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {expanded ? t.onboarding.roadmapCollapse : t.onboarding.roadmapExpand}
                {expanded ? (
                  <ChevronUp size={14} aria-hidden="true" />
                ) : (
                  <ChevronDown size={14} aria-hidden="true" />
                )}
              </button>
            )}
          </div>

          <ol className="space-y-3">
            {visibleItems.map((item) => {
              const summary = progressSummaries?.get(item.courseId) ?? null;
              const presentation = summary ? statusPresentation(summary.status, t) : null;
              const target =
                summary && summary.status === 'IN_PROGRESS'
                  ? (continuePath(summary) ?? `/courses/${item.courseId}`)
                  : `/courses/${item.courseId}`;

              return (
                <li
                  key={`${item.phase}-${item.courseId}`}
                  className="flex gap-4 items-start rounded-2xl border border-slate-100 dark:border-ink-700 p-4"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-black flex items-center justify-center">
                    {item.phase}
                  </div>
                  {item.courseThumbnail ? (
                    <img
                      src={item.courseThumbnail}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
                      <MapPin size={20} className="text-slate-400" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {item.courseTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.reason}</p>

                    {progressState === 'loading' && (
                      <div
                        className="h-5 w-32 mt-2 bg-slate-100 dark:bg-ink-800 rounded animate-pulse"
                        aria-hidden="true"
                      />
                    )}

                    {progressState === 'ready' && summary && (
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex-shrink-0">
                          {summary.totalLessons} {t.widgets.lessons}
                        </span>
                        <div className="flex-1 min-w-[48px] h-1.5 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${summary.progressPercent}%` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                          />
                        </div>
                        {presentation && (
                          <>
                            <span
                              className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${presentation.badgeClass}`}
                            >
                              {presentation.label}
                            </span>
                            <Link
                              to={target}
                              className="flex-shrink-0 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-full transition-colors"
                            >
                              {presentation.cta}
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <button
        type="button"
        onClick={onFinished}
        className="w-full inline-flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none transition-all"
      >
        <Sparkles size={16} aria-hidden="true" />
        {t.onboarding.roadmapGoToHome}
      </button>
    </div>
  );
};

export default RoadmapStep;
