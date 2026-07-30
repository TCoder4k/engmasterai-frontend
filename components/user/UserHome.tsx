import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import StudentLayout from './StudentLayout';
import { EmailVerificationBanner } from '../auth/EmailVerificationBanner';
import ReviewDueCard from './ReviewDueCard';
import ContinueLearningCard from './ContinueLearningCard';
import LearningTrackCard from './LearningTrackCard';
import UserSidebar from './UserSidebar';
import CourseCard from './CourseCard';
import { authService } from '../../services/authService';
import { getPublishedCourses } from '../../services/courseService';
import { getLibrariesProgress } from '../../services/learningService';
import {
  continuePath,
  CourseProgressSummary,
  getCourseProgressSummaries,
} from '../../services/courseProgressService';
import { getMostRecentActivityOfType } from '../../services/recentActivity';
import { getLessonSummaries } from '../practice/listening/listeningContent';
import { handleAuthError } from '../../services/apiError';
import { Course, CourseType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

const TRACK_TYPES: CourseType[] = ['GRAMMAR', 'VOCABULARY', 'LISTENING'];

// A Grammar lesson deep link is `/courses/:courseId/lessons/:lessonId`, and
// the recent-activity ring buffer stores that already-resolved path. Pulling
// the course id back out of it is what lets Continue Learning show a REAL
// completion percentage without a new API or a new stored field.
const courseIdFromPath = (path: string): string | null =>
  /^\/courses\/([^/]+)\/lessons\//.exec(path)?.[1] ?? null;

// Sprint 05 rebalanced this page around the three learning modules:
//
//   welcome -> due review -> continue learning -> modules -> recommended
//
// Restyled to `ai-studio-dashboard-reference`'s DashboardView: section
// headers carry their reference icons (Play / Compass / Sparkles), the
// Continue Learning banner is a gradient card with a progress bar, and each
// Learning Track shows how big it is.
//
// Every count on this page is real and comes from an API the corresponding
// page already uses — Grammar lessons from GET /courses, Vocabulary decks
// from the libraries-progress call this page already makes for the review
// card, and Listening from the seeded catalogue. The four right-rail widgets
// and the course star ratings are the exceptions, and they are marked as
// sample data (see components/user/dashboardContent.ts).
const UserHome: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = authService.getUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // null = not known (still loading, or the request failed). Every consumer
  // treats that as "say nothing", never as zero.
  const [dueTotal, setDueTotal] = useState<number | null>(null);
  const [deckCount, setDeckCount] = useState<number | null>(null);
  // Sprint 08 — server-derived progress for every course on this page. `null`
  // until the one batch request resolves, so cards show no status rather than
  // an invented one.
  const [progressByCourse, setProgressByCourse] = useState<Map<
    string,
    CourseProgressSummary
  > | null>(null);

  useEffect(() => {
    getPublishedCourses()
      .then((res) => setCourses(res.data))
      .catch((err) => setCoursesError(handleAuthError(err, navigate) || t.common.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetched once here and passed down, so the review card, Continue Learning
  // and the Vocabulary track share a single request rather than each issuing
  // their own. Supplementary: a failure leaves all three silent instead of
  // breaking the page.
  useEffect(() => {
    let cancelled = false;
    getLibrariesProgress()
      .then((res) => {
        if (cancelled) return;
        setDueTotal(res.data.reduce((sum, library) => sum + library.dueWords, 0));
        setDeckCount(res.data.reduce((sum, library) => sum + library.deckCount, 0));
      })
      .catch(() => {
        // Intentionally silent — see the comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sprint 08 — ONE request covering every course on the page.
  //
  // This replaced a lookup that started from the recent-activity ring buffer:
  // if THIS browser had no entry, no course id could be resolved, no request
  // was made, and the dashboard showed no progress whatsoever — on an account
  // that might be 80% through a course. Progress now comes from the courses
  // the page already fetched, so a fresh browser shows the same numbers as an
  // old one.
  useEffect(() => {
    if (courses.length === 0 || !user) return;
    let cancelled = false;
    getCourseProgressSummaries(courses.map((course) => course.id))
      .then((map) => {
        if (!cancelled) setProgressByCourse(map);
      })
      .catch(() => {
        // Stays null: no honest numbers, so none are shown.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, user?.id]);

  // Which Grammar course Continue Learning features, and where it points.
  //
  // Recent activity gets first say — "the course you were just in" is a good
  // answer and costs nothing. But it is only a HINT now: with no ring buffer,
  // the first course the server reports as in progress is used instead, and
  // the destination lesson always comes from the server's continuation rule
  // rather than from the last page this device happened to open.
  const featuredGrammar = useMemo(() => {
    if (!user || !progressByCourse) return null;

    const recent = getMostRecentActivityOfType(user.id, 'GRAMMAR');
    const recentCourseId = recent ? courseIdFromPath(recent.path) : null;
    const fromRecent = recentCourseId
      ? progressByCourse.get(recentCourseId)
      : undefined;
    if (fromRecent) return { summary: fromRecent, fromRecentActivity: true };

    const grammarIds = new Set(
      courses.filter((course) => course.type === 'GRAMMAR').map((c) => c.id),
    );
    const inProgress = [...progressByCourse.values()].find(
      (summary) =>
        grammarIds.has(summary.courseId) && summary.status === 'IN_PROGRESS',
    );
    return inProgress ? { summary: inProgress, fromRecentActivity: false } : null;
  }, [user, progressByCourse, courses]);

  const featuredTitle = featuredGrammar
    ? (courses.find((c) => c.id === featuredGrammar.summary.courseId)?.title ??
      null)
    : null;

  const trackCounts: Record<CourseType, number | null> = useMemo(
    () => ({
      GRAMMAR: courses
        .filter((course) => course.type === 'GRAMMAR')
        .reduce((sum, course) => sum + (course._count?.lessons ?? 0), 0),
      VOCABULARY: deckCount,
      LISTENING: getLessonSummaries().length,
    }),
    [courses, deckCount],
  );

  const firstName = user?.name?.split(' ').pop() || 'Learner';

  return (
    <StudentLayout>
      <EmailVerificationBanner />
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-6 lg:items-start max-w-[1400px]">
        {/* ---- Content ---- */}
        <div className="flex-1 min-w-0 space-y-8">
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.dashboard.welcomeBack}, {firstName}! 👋
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                {t.dashboard.keepLearning}
              </p>
            </div>

            {/* First actionable thing on the page — one click to reviewing. */}
            <ReviewDueCard dueTotal={dueTotal} />
          </div>

          <ContinueLearningCard
            dueTotal={dueTotal}
            progressPercent={featuredGrammar?.summary.progressPercent ?? null}
            grammarContinuePath={
              featuredGrammar ? continuePath(featuredGrammar.summary) : null
            }
            // Only needed when recent activity did NOT name the course — the
            // card already has a title in that case.
            grammarFallbackTitle={
              featuredGrammar && !featuredGrammar.fromRecentActivity
                ? featuredTitle
                : null
            }
          />

          {/* Learning Tracks — the three module entry points. Horizontal snap
              carousel on phones, 3-col grid from sm up. The carousel's own
              overflow is intentional; the negative margins keep it inside the
              page padding so the page itself never scrolls horizontally. */}
          <section aria-label={t.dashboard.learningTracks} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
                {t.dashboard.learningTracks}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t.dashboard.coreModules}
              </span>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
              {TRACK_TYPES.map((type) => (
                <LearningTrackCard key={type} type={type} count={trackCounts[type]} />
              ))}
            </div>
          </section>

          {/* Recommended for You — the page's real data feed (GET /courses),
              across all three course types. */}
          <section aria-label={t.dashboard.recommendedForYou} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                {t.dashboard.recommendedForYou}
              </h2>
              <Link
                to="/courses"
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg px-1"
              >
                {t.common.viewAll}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {coursesError && <p className="text-sm font-medium text-rose-500">{coursesError}</p>}

            {!coursesError && courses.length === 0 && (
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {t.dashboard.noCoursesYet}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  progress={progressByCourse?.get(course.id) ?? null}
                />
              ))}
            </div>
          </section>

          {/* On phones/tablets the widgets flow here, below the courses,
              as normal full-width sections (no narrow side column). */}
          <div className="lg:hidden">
            <UserSidebar />
          </div>
        </div>

        {/* ---- Desktop-only right widget column ---- */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          <UserSidebar />
        </div>
      </div>
    </StudentLayout>
  );
};

export default UserHome;
