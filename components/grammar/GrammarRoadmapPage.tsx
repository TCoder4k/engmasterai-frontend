import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Compass, GraduationCap, Sparkles } from 'lucide-react';
import StudentLayout from '../user/StudentLayout';
import GrammarCourseCard from './GrammarCourseCard';
import { GrammarCategory, deriveGrammarCategory, presentGrammarCategories } from './grammarCategory';
import EmptyState from '../shared/EmptyState';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { getPublishedCourses } from '../../services/courseService';
import { getCourseLessons } from '../../services/lessonService';
import { authService } from '../../services/authService';
import {
  getCourseProgress,
  CourseProgress,
  LessonProgressSnapshot,
} from '../../services/lessonProgress';
import { getCourseProgressMap } from '../../services/progressService';
import { handleAuthError } from '../../services/apiError';
import { Course, Lesson } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

// /grammar — the Grammar ROADMAP. The product model is
// Grammar -> Roadmap -> Course -> Lesson -> Learning Engine, so this page is
// a path a student is progressing along, not a catalog they are browsing.
// "Catalog" describes /courses; it must not describe this page.
//
// Course and Lesson remain the implementation underneath: this reuses the
// existing GET /courses feed with its server-side type filter, and cards link
// into the existing /courses/:id route. No parallel Course domain.
//
// Structure follows the AI Studio reference's roadmap screen. Its search
// input is deliberately not reproduced — Grammar holds tens of courses, and
// the collection chips are enough at that size.
const GrammarRoadmapPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = authService.getUser();
  const userId = user?.id;

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<GrammarCategory | null>(null);
  const [lessonsByCourse, setLessonsByCourse] = useState<Map<string, Lesson[]>>(new Map());
  // Sprint 07 — one flat map keyed by lessonId (ids are unique across
  // courses), merged from one aggregated call per course. It replaced three
  // parallel maps built from three requests per course. Same silent-degrade
  // rule as before: a failure just leaves lessons looking not-yet-finished.
  const [progressByLessonId, setProgressByLessonId] = useState<
    Map<string, LessonProgressSnapshot>
  >(new Map());

  useEffect(() => {
    getPublishedCourses(undefined, 100, 'GRAMMAR')
      .then((res) => setCourses(res.data))
      .catch((err) => setError(handleAuthError(err, navigate) || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real duration and real completion both need per-course lesson data, and
  // GET /courses does not carry it. Fetching one lessons request per course
  // is a DELIBERATE trade-off, not an oversight: Grammar holds roughly 10-30
  // courses, so this is a few dozen small parallel requests once, on one
  // page — cheaper than widening a backend contract that the Learning Engine
  // work just stabilised. If the roadmap ever grows well past that, the fix
  // is a backend aggregate on the course endpoint.
  //
  // It is also supplementary: cards have already painted from the course
  // response by the time this resolves, and a failure here leaves them with
  // title, badges and lesson count but no duration or progress — the same
  // silent-degrade rule VocabLibraryPage uses.
  useEffect(() => {
    if (courses.length === 0) return;
    let cancelled = false;

    Promise.all(
      courses.map((course) =>
        getCourseLessons(course.id)
          .then((res) => [course.id, res.data] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      const next = new Map<string, Lesson[]>();
      results.forEach((entry) => {
        if (entry) next.set(entry[0], entry[1]);
      });
      setLessonsByCourse(next);
    });

    return () => {
      cancelled = true;
    };
  }, [courses]);

  // Sprint 07 — ONE aggregated request per course, covering every stage
  // including the video and theory steps.
  //
  // Fetching the steps is what keeps this page CORRECT rather than merely
  // richer: both gate isLessonComplete(), so without them every lesson would
  // read as incomplete here no matter how much had been watched, while the
  // lesson page showed it finished.
  //
  // Failure leaves the map empty, which reports every stage not-started — a
  // stale percentage, never an inflated one.
  useEffect(() => {
    if (courses.length === 0 || !userId) return;
    let cancelled = false;

    Promise.all(
      courses.map((course) =>
        getCourseProgressMap(course.id).catch(
          () => new Map<string, LessonProgressSnapshot>(),
        ),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<string, LessonProgressSnapshot>();
      results.forEach((courseMap) => {
        courseMap.forEach((snapshot, lessonId) => map.set(lessonId, snapshot));
      });
      setProgressByLessonId(map);
    });

    return () => {
      cancelled = true;
    };
  }, [courses, userId]);

  // Only collections actually present get a chip, so a filter can never
  // resolve to an empty list.
  const categories = useMemo(() => presentGrammarCategories(courses), [courses]);

  const visibleCourses = useMemo(
    () =>
      activeCategory
        ? courses.filter((course) => deriveGrammarCategory(course) === activeCategory)
        : courses,
    [courses, activeCategory],
  );

  const progressByCourse = useMemo(() => {
    const map = new Map<string, CourseProgress>();
    lessonsByCourse.forEach((lessons, courseId) => {
      map.set(
        courseId,
        getCourseProgress(userId, lessons, progressByLessonId),
      );
    });
    return map;
  }, [lessonsByCourse, userId, progressByLessonId]);

  // Roadmap-wide totals. Rendered only once every course's lessons are in,
  // so a partial figure never briefly claims a lower total than the truth.
  const roadmapProgress = useMemo(() => {
    if (courses.length === 0 || lessonsByCourse.size !== courses.length) return null;
    let completed = 0;
    let total = 0;
    progressByCourse.forEach((progress) => {
      completed += progress.completed;
      total += progress.total;
    });
    if (total === 0) return null;
    return {
      completed,
      total,
      percent: Math.floor((completed / total) * 100),
      // The x/y count is honest at zero; a 0% BAR is not — it is a claim
      // about progress a student who has started nothing has not earned.
      showBar: completed > 0,
    };
  }, [courses, lessonsByCourse, progressByCourse]);

  const categoryLabels: Record<GrammarCategory, string> = {
    TOEIC: t.grammar.categoryTOEIC,
    GRAMMAR_IN_USE: t.grammar.categoryGrammarInUse,
    DESTINATION: t.grammar.categoryDestination,
    FOUNDATION: t.grammar.categoryFoundation,
  };

  const chipClass = (isActive: boolean) =>
    `px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      isActive
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
        : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900 dark:bg-ink-950 dark:text-slate-400 dark:border-ink-700 dark:hover:text-white'
    }`;

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ---- Roadmap hero ---- */}
        <section className="relative overflow-hidden bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-2xl space-y-6">
          <div
            className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-24 -left-24 w-96 h-96 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 dark:border dark:border-blue-500/30">
                <Compass size={14} aria-hidden="true" />
                {t.grammar.roadmapBadge}
              </span>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.grammar.roadmapTitle}
              </h1>

              <p className="text-sm font-medium text-slate-500 dark:text-slate-300 leading-relaxed">
                {t.grammar.roadmapSubtitle}
              </p>
            </div>

            {/* Stat badge — every figure real. The reference also shows an
                overall progress bar here; ours renders only once real local
                completion data exists, and never as a zeroed placeholder. */}
            {!isLoading && !error && courses.length > 0 && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-ink-950/80 dark:border dark:border-ink-700 rounded-2xl shrink-0 lg:min-w-[260px]">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-400">
                    <BookOpen size={13} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
                    {courses.length === 1 ? t.grammar.oneCourseUnit : t.grammar.coursesUnit}
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{courses.length}</p>
                </div>

                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-400">
                    <GraduationCap size={13} className="text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
                    {t.grammar.lessonsUnit}
                  </p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {roadmapProgress ? `${roadmapProgress.completed}/${roadmapProgress.total}` : '—'}
                  </p>
                </div>

                {roadmapProgress?.showBar && (
                  <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-ink-700 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-400 dark:text-slate-400">{t.grammar.overallProgress}</span>
                      <span className="text-blue-600 dark:text-blue-400">{roadmapProgress.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-ink-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${roadmapProgress.percent}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                      />
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      {t.grammar.progressSynced}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---- Collection chips (no search input — decision 4) ---- */}
          {categories.length > 0 && (
            <div
              role="group"
              aria-label={t.grammar.filterLabel}
              className="relative flex items-center gap-2 overflow-x-auto pt-4 border-t border-slate-100 dark:border-ink-700/60"
            >
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                aria-pressed={activeCategory === null}
                className={chipClass(activeCategory === null)}
              >
                {t.grammar.allCategories}
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  aria-pressed={activeCategory === category}
                  className={chipClass(activeCategory === category)}
                >
                  {categoryLabels[category]}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---- Course grid ---- */}
        <section aria-label={t.grammar.collectionsHeading} className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <Sparkles size={18} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
            {t.grammar.collectionsHeading}
          </h2>

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-80 w-full" />
              ))}
            </div>
          )}

          {error && <ErrorState message={error} />}

          {!isLoading && !error && courses.length === 0 && (
            <EmptyState icon={<BookOpen size={32} />} message={t.grammar.noGrammarCourses} />
          )}

          {!isLoading && !error && courses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleCourses.map((course) => (
                <GrammarCourseCard
                  key={course.id}
                  course={course}
                  lessons={lessonsByCourse.get(course.id) ?? null}
                  progress={progressByCourse.get(course.id) ?? null}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </StudentLayout>
  );
};

export default GrammarRoadmapPage;
