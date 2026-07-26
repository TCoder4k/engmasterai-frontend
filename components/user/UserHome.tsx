import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
import { handleAuthError } from '../../services/apiError';
import { Course, CourseType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

const TRACK_TYPES: CourseType[] = ['GRAMMAR', 'VOCABULARY', 'LISTENING'];

// Sprint 05 rebalanced this page around the three learning modules:
//
//   welcome -> due review -> continue learning -> modules -> recommended
//
// The header search box was removed (it only filtered this page's own small
// client-side grid), and with it the search + type-filter state: Learning
// Tracks are now real links into /grammar, /vocab and /practice/listening,
// which is a better answer to "show me one area" than a text filter was.
const UserHome: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = authService.getUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // null = not known (still loading, or the request failed). Both the review
  // card and Continue Learning treat that as "say nothing", never as zero.
  const [dueTotal, setDueTotal] = useState<number | null>(null);

  useEffect(() => {
    getPublishedCourses()
      .then((res) => setCourses(res.data))
      .catch((err) => setCoursesError(handleAuthError(err, navigate) || t.common.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetched once here and passed down, so the review card and Continue
  // Learning share a single request rather than each issuing their own.
  // Supplementary: a failure leaves both silent instead of breaking the page.
  useEffect(() => {
    let cancelled = false;
    getLibrariesProgress()
      .then((res) => {
        if (cancelled) return;
        setDueTotal(res.data.reduce((sum, library) => sum + library.dueWords, 0));
      })
      .catch(() => {
        // Intentionally silent — see the comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.name?.split(' ').pop() || 'Learner';

  return (
    <StudentLayout>
      <EmailVerificationBanner />
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-6 lg:items-start max-w-[1400px]">
        {/* ---- Content ---- */}
        <div className="flex-1 min-w-0 space-y-8 lg:space-y-10">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-[28px] font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {t.dashboard.welcomeBack}, {firstName}! 👋
              </h1>
              <p className="text-[15px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                {t.dashboard.keepLearning}
              </p>
            </div>

            {/* First actionable thing on the page — one click to reviewing. */}
            <ReviewDueCard dueTotal={dueTotal} />
          </div>

          <ContinueLearningCard dueTotal={dueTotal} />

          {/* Learning Tracks — the three module entry points. Horizontal snap
              carousel on phones, 3-col grid from md up. The carousel's own
              overflow is intentional; the negative margins keep it inside the
              page padding so the page itself never scrolls horizontally. */}
          <section aria-label={t.dashboard.learningTracks}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {t.dashboard.learningTracks}
              </h2>
              <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {t.dashboard.coreModules}
              </span>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
              {TRACK_TYPES.map((type) => (
                <LearningTrackCard key={type} type={type} />
              ))}
            </div>
          </section>

          {/* Recommended for You — the page's real data feed (GET /courses),
              across all three course types. */}
          <section aria-label={t.dashboard.recommendedForYou}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {t.dashboard.recommendedForYou}
              </h2>
              <Link
                to="/courses"
                className="flex items-center space-x-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-1"
              >
                <span>{t.common.viewAll}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            {coursesError && (
              <p className="text-sm font-medium text-rose-500">{coursesError}</p>
            )}

            {!coursesError && courses.length === 0 && (
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {t.dashboard.noCoursesYet}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
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
