import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, ChevronUp, Map, MapPin, RotateCw, Sparkles } from 'lucide-react';
import { LearningGoal } from '../../types';
import {
  RoadmapView,
  getPlacementRoadmap,
  requestPlacementRoadmapAnalysis,
} from '../../services/placementService';
import {
  CourseProgressSummary,
  continuePath,
  getCourseProgressSummaries,
} from '../../services/courseProgressService';
import { ApiError, handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';
import { StringKeys, TranslationDict } from '../../i18n/translations';
import Skeleton from '../shared/Skeleton';
import { DEFAULT_DAILY_TARGETS } from './dailyTargets';

const GOAL_LABEL_KEY: Record<LearningGoal, StringKeys<TranslationDict['onboarding']>> = {
  FOUNDATION: 'goalFoundation',
  TOEIC_450: 'goalToeic450',
  TOEIC_650: 'goalToeic650',
  TOEIC_800: 'goalToeic800',
  GENERAL_ENGLISH: 'goalGeneralEnglish',
  REGULAR_PRACTICE: 'goalRegularPractice',
};

// Phase 7 — Dashboard integration + the retake entry point, in one card.
//
// Self-contained (own GET /placement/roadmap fetch on mount), the same
// pattern RoadmapStep.tsx already uses inside the wizard — nothing else on
// /home shares this data, so there is no batch request to join.
//
// THREE STATES, not the loading/data/silent-fail pair most dashboard cards
// use: a 404 here is a common, LEGITIMATE state (every pre-migration account
// was backfilled to onboarded: true with no Roadmap row at all — see the
// migration note in placement.service.ts), not a failure, so it gets its own
// prompt rather than being folded into "render nothing". Any OTHER error
// degrades silently, matching ReviewDueCard/ContinueLearningCard's own
// "supplementary request, quiet on failure" convention — a student's
// dashboard should not break because one secondary widget's fetch failed.
// 'loading' -> skeleton; 'none' (404) -> the create-roadmap prompt; 'failed'
// (any other error) -> render nothing, and STAY nothing, rather than being
// stuck on the loading skeleton forever — the two are different states and
// collapsing them into one boolean was a real bug caught before it shipped:
// a transient network failure would otherwise show a permanent skeleton
// instead of quietly degrading like its sibling cards do.
type LoadState = 'loading' | 'none' | 'ready' | 'failed';

// The per-phase lesson-count/progress-bar/status-badge below depends on a
// SECOND request (GET /progress/courses, the same canonical read
// CourseCard/CourseDetailPage already use) that is entirely independent of
// the roadmap-existence fetch above — mirrors RoadmapStep.tsx's identical
// split. Its own failure never blocks or errors the phase list itself; the
// thumbnail/title/description already came from `roadmap` and stay visible.
type ProgressState = 'loading' | 'ready' | 'error';

// Collapsed by default on the dashboard (space is shared with several other
// widgets) — expands in place rather than linking to a separate "full
// roadmap" page, since no such page exists outside the onboarding wizard.
const COLLAPSED_PHASE_COUNT = 3;

// An ESTIMATE, never presented as exact — real content-authoring data
// (totalEstimatedMinutes, summed from Lesson.estimatedStudyMinutes) divided
// by the app's own real, already-established daily-goal pace
// (DEFAULT_DAILY_TARGETS.studyMinutes — a product default, not invented for
// this). Rounded UP and floored at 1 week: "0 tuần" would be a stranger
// answer than a slightly generous one for a very short course.
const estimatedWeeksFor = (totalEstimatedMinutes: number): number =>
  Math.max(
    1,
    Math.ceil(totalEstimatedMinutes / (DEFAULT_DAILY_TARGETS.studyMinutes * 7)),
  );

const RoadmapCard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>('loading');
  const [roadmap, setRoadmap] = useState<RoadmapView | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [progressSummaries, setProgressSummaries] = useState<Map<
    string,
    CourseProgressSummary
  > | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>('loading');

  useEffect(() => {
    let cancelled = false;
    getPlacementRoadmap()
      .then((view) => {
        if (cancelled) return;
        setRoadmap(view);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setState(err instanceof ApiError && err.status === 404 ? 'none' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleRequestAnalysis = async () => {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const result = await requestPlacementRoadmapAnalysis();
      setRoadmap((prev) => (prev ? { ...prev, aiSummary: result.summary } : prev));
    } catch (err) {
      setAnalysisError(
        handleAuthError(err, navigate) || t.dashboard.roadmapCard.aiSummaryFailed,
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (state === 'loading') {
    return <Skeleton className="h-48 w-full" />;
  }

  if (state === 'failed') {
    return null;
  }

  const copy = t.dashboard.roadmapCard;

  if (state === 'none') {
    return (
      <section
        aria-label={copy.emptyTitle}
        className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div
          className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <Map size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{copy.emptyTitle}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{copy.emptyBody}</p>
        </div>
        <Link
          to="/onboarding/retake"
          className="inline-flex items-center justify-center gap-1.5 flex-shrink-0 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {copy.createCta}
        </Link>
      </section>
    );
  }

  // roadmap is guaranteed non-null here: state only ever becomes 'ready' in
  // the same .then() that sets it.
  const view = roadmap!;
  const showToggle = view.items.length > COLLAPSED_PHASE_COUNT;
  const visibleItems =
    expanded || !showToggle ? view.items : view.items.slice(0, COLLAPSED_PHASE_COUNT);

  return (
    <section
      aria-label={copy.title}
      className="bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <Map size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{copy.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {t.onboarding[GOAL_LABEL_KEY[view.goal]]}
              {view.estimatedLevel && ` · ${copy.estimatedLevel}: ${view.estimatedLevel}`}
            </p>
          </div>
        </div>
        <Link
          to="/onboarding/retake"
          className="inline-flex items-center gap-1 flex-shrink-0 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors rounded-lg px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <RotateCw size={13} aria-hidden="true" />
          {copy.retakeCta}
        </Link>
      </div>

      {view.items.length > 0 && (
        <ol className="space-y-0">
          {visibleItems.map((item, index) => {
            const summary = progressSummaries?.get(item.courseId) ?? null;
            const target =
              summary && summary.status === 'IN_PROGRESS'
                ? (continuePath(summary) ?? `/courses/${item.courseId}`)
                : `/courses/${item.courseId}`;
            const isLast = index === visibleItems.length - 1;

            return (
              <li key={`${item.phase}-${item.courseId}`} className="flex gap-3">
                {/* The connecting line fills the flex column's remaining
                    height after the circle, so it always reaches exactly to
                    the next phase's circle regardless of this row's content
                    height — no hardcoded pixel offsets to keep in sync with
                    spacing changes. */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    {item.phase}
                  </span>
                  {!isLast && (
                    <span
                      className="w-0.5 flex-1 bg-slate-200 dark:bg-ink-700 my-1"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <Link
                  to={target}
                  className="flex-1 min-w-0 flex items-center gap-4 rounded-xl p-3 mb-2 hover:bg-slate-50 dark:hover:bg-ink-800 transition-colors group"
                >
                  {item.courseThumbnail ? (
                    <img
                      src={item.courseThumbnail}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0"
                      aria-hidden="true"
                    >
                      <MapPin size={20} className="text-slate-400" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {item.courseTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.reason}
                    </p>

                    {/* Independent of the progress fetch below — this comes
                        straight from the roadmap item itself, so it appears
                        as soon as the roadmap loads rather than waiting on
                        progressState. Omitted entirely (not "~1 tuần") for a
                        course with no lessons carrying a duration. */}
                    {item.totalEstimatedMinutes > 0 && (
                      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                        {copy.estimatedWeeks(estimatedWeeksFor(item.totalEstimatedMinutes))}
                      </p>
                    )}

                    {progressState === 'loading' && (
                      <div
                        className="h-3.5 w-28 mt-1.5 bg-slate-100 dark:bg-ink-800 rounded animate-pulse"
                        aria-hidden="true"
                      />
                    )}
                    {progressState === 'ready' && summary && (
                      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                        {summary.totalLessons} {t.widgets.lessons}
                      </p>
                    )}
                  </div>

                  {progressState === 'ready' && summary && (
                    <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 w-24">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {summary.progressPercent}%
                      </span>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${summary.progressPercent}%` }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  <ChevronRight
                    size={18}
                    className="flex-shrink-0 text-slate-300 dark:text-ink-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          {expanded ? copy.collapseCta : copy.viewAllCta}
          {expanded ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          )}
        </button>
      )}

      <div className="border-t border-slate-100 dark:border-ink-800 pt-3">
        {view.aiSummary ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed flex gap-2">
            <Sparkles size={14} className="flex-shrink-0 mt-0.5 text-indigo-500" aria-hidden="true" />
            <span>{view.aiSummary}</span>
          </p>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => void handleRequestAnalysis()}
              disabled={analysisLoading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg"
            >
              <Sparkles size={14} aria-hidden="true" />
              {analysisLoading ? copy.aiSummaryLoading : copy.aiSummaryCta}
            </button>
            {analysisError && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {analysisError}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default RoadmapCard;
