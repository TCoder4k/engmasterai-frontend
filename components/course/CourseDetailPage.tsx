import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import LessonListItem from './LessonListItem';
import EmptyState from '../shared/EmptyState';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { getPublishedCourse } from '../../services/courseService';
import { getCourseLessons } from '../../services/lessonService';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { recordRecentActivity } from '../../services/recentActivity';
import {
  CourseProgressSummary,
  getCourseProgressSummaries,
} from '../../services/courseProgressService';
import { resolveLessonRowState } from '../../services/courseStatus';
import { Course, Lesson } from '../../types';
import { AlertCircle, ArrowLeft, BookOpen, Clock, Layers } from 'lucide-react';
import {
  GrammarCategory,
  deriveCourseLevel,
  deriveGrammarCategory,
} from '../grammar/grammarCategory';
import { useTranslation } from '../../i18n/useTranslation';

const TRACK_KEY: Record<Course['type'], 'grammar' | 'vocabulary' | 'listening'> = {
  GRAMMAR: 'grammar',
  VOCABULARY: 'vocabulary',
  LISTENING: 'listening',
};

const CourseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sprint 08 — the SERVER's course summary and per-lesson statuses.
  //
  // `progressState` is tracked separately and explicitly, because "we have no
  // progress" and "we could not load the progress" are different facts and the
  // page previously conflated them: every failure set an empty map, which
  // rendered as every lesson not-yet-started. A student who had finished half
  // the course was told they had finished none of it, silently.
  const [progress, setProgress] = useState<CourseProgressSummary | null>(null);
  const [progressState, setProgressState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  // Bumped by the retry button to re-run the effect below.
  const [progressAttempt, setProgressAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([getPublishedCourse(id), getCourseLessons(id)])
      .then(([courseRes, lessonsRes]) => {
        setCourse(courseRes);
        setLessons(lessonsRes.data);
      })
      .catch((err) => setError(handleAuthError(err, navigate) || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sprint 08 — ONE request, and the server has already done the deriving.
  //
  // `include=lessons` because this is the one surface that renders a row per
  // lesson; the catalog and the dashboard ask for summaries only.
  useEffect(() => {
    if (!id) return;
    // Logged out there is no progress to speak of, and the endpoint requires
    // auth — asking would be a guaranteed 401.
    if (!authService.getUser()) {
      setProgressState('ready');
      return;
    }

    let cancelled = false;
    setProgressState('loading');
    getCourseProgressSummaries([id], { includeLessons: true })
      .then((map) => {
        if (cancelled) return;
        // A visible course always comes back. An absent one means unpublished
        // or unknown, which is not an error here — the page itself already
        // 404s in that case through getPublishedCourse.
        setProgress(map.get(id) ?? null);
        setProgressState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        // Explicit, and NOT an empty map. The rows render an error state with
        // a retry rather than quietly claiming nothing has been started.
        setProgress(null);
        setProgressState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, progressAttempt]);

  // Records the Continue Learning entry once the course is actually
  // loaded — this page has every id it needs in scope, so the ring buffer
  // entry stores the already-resolved path (design doc §5).
  useEffect(() => {
    if (!course) return;
    const user = authService.getUser();
    if (!user) return;
    recordRecentActivity(user.id, {
      type: 'course',
      id: course.id,
      title: course.title,
      path: `/courses/${course.id}`,
      // Sprint 05 — lets Continue Learning prioritise Grammar.
      courseType: course.type,
    });
  }, [course]);

  // Sprint 05 — Grammar is a student-facing module, so a Grammar course
  // returns to /grammar rather than the generic catalog. Everything else
  // still goes back to /courses, which remains the all-type catalog reached
  // from the Dashboard.
  const isGrammar = course?.type === 'GRAMMAR';
  const backTo = isGrammar ? '/grammar' : '/courses';
  const backLabel = isGrammar ? t.grammar.backToRoadmap : t.course.backToCourses;

  // Sprint 08 — the status of each lesson, keyed for the rows below. Built
  // from the server's answer; this page no longer derives completion at all.
  const statusByLessonId = new Map(
    (progress?.lessons ?? []).map((row) => [row.lessonId, row.status]),
  );

  const category = course && isGrammar ? deriveGrammarCategory(course) : null;
  const level = course && isGrammar ? deriveCourseLevel(course) : null;

  // Real published lessons (GET /courses/:id/lessons returns published only)
  // and their real summed study time. No XP tile and no average-accuracy tile
  // like the design reference has: both are mock there and have no backend.
  const totalMinutes = lessons.reduce((sum, lesson) => sum + (lesson.estimatedStudyMinutes ?? 0), 0);

  const categoryLabels: Record<GrammarCategory, string> = {
    TOEIC: t.grammar.categoryTOEIC,
    GRAMMAR_IN_USE: t.grammar.categoryGrammarInUse,
    DESTINATION: t.grammar.categoryDestination,
    FOUNDATION: t.grammar.categoryFoundation,
  };

  return (
    <StudentLayout>
      <div className="max-w-5xl mx-auto">
        <Link
          to={backTo}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors mb-8 min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {error && <ErrorState message={error} />}

        {!isLoading && !error && course && (
          <>
            {/* Course hero — structure follows the design reference's course
                banner (badge row, large title, description, stat tiles). Its
                XP tile and average-accuracy tile are omitted: both are mock
                in the reference with no field behind them here. The progress
                bar IS real (device-local completed lessons) and renders only
                once something has actually been completed. */}
            <section className="relative overflow-hidden bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-2xl mb-8">
              <div
                className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
                aria-hidden="true"
              />

              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 uppercase">
                      {t.tracks[TRACK_KEY[course.type]].label}
                    </span>
                    {level && (
                      <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {level}
                      </span>
                    )}
                    {category && (
                      <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-md bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                        {categoryLabels[category]}
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-[28px] font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                    {course.title}
                  </h2>

                  <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium leading-relaxed">
                    {course.description}
                  </p>
                </div>

                {lessons.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 shrink-0 lg:min-w-[260px]">
                    <div className="p-4 bg-slate-50 dark:bg-ink-950/80 dark:border dark:border-ink-700 rounded-2xl text-center space-y-1">
                      <Layers size={16} className="mx-auto text-blue-500 dark:text-blue-400" aria-hidden="true" />
                      <p className="text-lg font-black text-slate-900 dark:text-white">
                        {/* An em dash, not a zero, until the real number
                            arrives — "0/5" is a claim about the student. */}
                        {progress
                          ? `${progress.completedLessons}/${progress.totalLessons}`
                          : '—'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {t.grammar.lessonsCompleted}
                      </p>
                    </div>

                    {/* Only rendered when lessons actually carry study times —
                        a course with none shows one tile, not a zero. */}
                    {totalMinutes > 0 && (
                      <div className="p-4 bg-slate-50 dark:bg-ink-950/80 dark:border dark:border-ink-700 rounded-2xl text-center space-y-1">
                        <Clock size={16} className="mx-auto text-violet-500 dark:text-violet-400" aria-hidden="true" />
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                          {totalMinutes}
                          <span className="text-xs font-bold ml-0.5">{t.lesson.minutesUnit}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          {t.course.totalDuration}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Real progress only. A 0% bar is not a neutral placeholder —
                  it is a claim an untouched course has not earned. */}
              {progress && progress.completedLessons > 0 && (
                <div className="relative mt-6 pt-5 border-t border-slate-100 dark:border-ink-700 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-300">{t.grammar.progressLabel}</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {progress.progressPercent}% ({progress.completedLessons}/
                      {progress.totalLessons})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${progress.progressPercent}%` }}
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                    />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {t.grammar.progressSynced}
                  </p>
                </div>
              )}

              {/* Said out loud, with a way out. The page used to swallow this
                  and render every lesson as not-yet-started. */}
              {progressState === 'error' && (
                <div className="relative mt-6 pt-5 border-t border-slate-100 dark:border-ink-700 flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <AlertCircle size={14} aria-hidden="true" />
                    {t.course.progressLoadFailed}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProgressAttempt((n) => n + 1)}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-slate-300 dark:hover:bg-ink-700 transition-colors min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {t.course.retryProgress}
                  </button>
                </div>
              )}
            </section>

            {lessons.length === 0 && (
              <EmptyState icon={<BookOpen size={32} />} message={t.course.noLessonsYet} />
            )}

            {lessons.length > 0 && (
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-4">
                {t.course.lessonsHeading}
              </h3>
            )}

            <div className="space-y-3">
              {lessons.map((lesson, index) => (
                <LessonListItem
                  key={lesson.id}
                  courseId={course.id}
                  lesson={lesson}
                  orderNumber={index + 1}
                  state={resolveLessonRowState(
                    progressState,
                    statusByLessonId.get(lesson.id),
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default CourseDetailPage;
