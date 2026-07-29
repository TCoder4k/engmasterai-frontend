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
  getCourseProgress,
  QuizStageProgress,
  TrapHunterStageProgress,
} from '../../services/lessonProgress';
import { getCourseQuizProgress } from '../../services/quizService';
import { getCourseTrapHunterProgress } from '../../services/trapHunterService';
import { Course, Lesson } from '../../types';
import { ArrowLeft, BookOpen, Clock, Layers } from 'lucide-react';
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
  // Sprint 06B — server-side quiz progress, keyed by lessonId. Supplementary
  // (like GrammarRoadmapPage's per-course lesson fetch): the page has
  // already painted from course+lessons by the time this resolves, and a
  // failure here just leaves every quiz-bearing lesson looking not-yet-passed
  // rather than breaking the page.
  const [quizProgressByLessonId, setQuizProgressByLessonId] = useState<Map<string, QuizStageProgress>>(
    new Map(),
  );
  // Sprint 06C — the same arrangement for Trap Hunter.
  const [trapProgressByLessonId, setTrapProgressByLessonId] = useState<
    Map<string, TrapHunterStageProgress>
  >(new Map());

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

  useEffect(() => {
    if (!id || !authService.getUser()) return;
    getCourseQuizProgress(id)
      .then((res) => {
        const map = new Map<string, QuizStageProgress>();
        res.data.forEach((row) => {
          map.set(row.lessonId, { passed: row.passed, attemptsCount: row.attemptsCount });
        });
        setQuizProgressByLessonId(map);
      })
      .catch(() => {
        // Silent — quiz-bearing lessons simply render as not-yet-passed.
      });
  }, [id]);

  // Sprint 06C — the companion fetch. Without it this page would call a
  // lesson complete while the lesson page itself showed an open Trap Hunter
  // stage. Failure leaves the map empty, which drops 'traphunter' out of
  // availableStages entirely and reproduces the pre-06C percentage exactly
  // — a stale number, never a wrong one.
  useEffect(() => {
    if (!id || !authService.getUser()) return;
    getCourseTrapHunterProgress(id)
      .then((res) => {
        const map = new Map<string, TrapHunterStageProgress>();
        res.data.forEach((row) => {
          map.set(row.lessonId, {
            hasSource: row.hasSource,
            total: row.total,
            cleared: row.cleared,
          });
        });
        setTrapProgressByLessonId(map);
      })
      .catch(() => {
        // Silent, same reasoning as the quiz fetch above.
      });
  }, [id]);

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

  // Real, device-local completion (Sprint 06). Counts COMPLETED lessons —
  // every stage a lesson offers, finished — not videos watched, so the
  // Mini Check and Practice stages can land later without this UI changing.
  const progress = getCourseProgress(
    authService.getUser()?.id,
    lessons,
    quizProgressByLessonId,
    trapProgressByLessonId,
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
                        {progress.completed}/{lessons.length}
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

              {/* Real progress only — absent entirely until at least one
                  lesson has actually been completed on this device. */}
              {progress.completed > 0 && (
                <div className="relative mt-6 pt-5 border-t border-slate-100 dark:border-ink-700 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-300">{t.grammar.progressLabel}</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {progress.percent}% ({progress.completed}/{progress.total})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${progress.percent}%` }}
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                    />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {t.grammar.onThisDevice}
                  </p>
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
                  quizProgress={quizProgressByLessonId.get(lesson.id)}
                  trapProgress={trapProgressByLessonId.get(lesson.id)}
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
