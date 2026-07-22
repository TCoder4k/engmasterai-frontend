import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import StudentLayout from './StudentLayout';
import { EmailVerificationBanner } from '../auth/EmailVerificationBanner';
import ContinueLearningCard from './ContinueLearningCard';
import LearningTrackCard from './LearningTrackCard';
import UserSidebar from './UserSidebar';
import CourseCard from './CourseCard';
import { authService } from '../../services/authService';
import { getPublishedCourses } from '../../services/courseService';
import { handleAuthError } from '../../services/apiError';
import { Course, CourseType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

const TRACK_TYPES: CourseType[] = ['GRAMMAR', 'VOCABULARY', 'LISTENING'];

const UserHome: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = authService.getUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CourseType | null>(null);

  useEffect(() => {
    getPublishedCourses()
      .then((res) => setCourses(res.data))
      .catch((err) => setCoursesError(handleAuthError(err, navigate) || t.common.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Header search + track filter both narrow the recommended grid
  // client-side — the only real course feed this page has.
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      if (typeFilter && course.type !== typeFilter) return false;
      if (!query) return true;
      return (
        course.title.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query)
      );
    });
  }, [courses, search, typeFilter]);

  const firstName = user?.name?.split(' ').pop() || 'Learner';

  const clearFilters = () => {
    setSearch('');
    setTypeFilter(null);
  };

  return (
    <StudentLayout search={{ value: search, onChange: setSearch }}>
      <EmailVerificationBanner />
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-6 lg:items-start max-w-[1400px]">
        {/* ---- Content ---- */}
        <div className="flex-1 min-w-0 space-y-8 lg:space-y-10">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {t.dashboard.welcomeBack}, {firstName}! 👋
            </h1>
            <p className="text-[15px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              {t.dashboard.keepLearning}
            </p>
          </div>

          <ContinueLearningCard />

          {/* Learning Tracks — horizontal snap carousel on phones, 3-col
              grid from md up. The carousel's own overflow is intentional;
              the negative margins keep it inside the page padding so the
              page itself never scrolls horizontally. */}
          <section aria-label={t.dashboard.learningTracks}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {t.dashboard.learningTracks}
              </h2>
              <button
                type="button"
                onClick={() => setTypeFilter(null)}
                className="flex items-center space-x-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-1"
              >
                <span>{t.common.viewAll}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
              {TRACK_TYPES.map((type) => (
                <LearningTrackCard
                  key={type}
                  type={type}
                  active={typeFilter === type}
                  onSelect={() =>
                    setTypeFilter((current) => (current === type ? null : type))
                  }
                />
              ))}
            </div>
          </section>

          {/* Recommended for You — the page's real data feed (GET /courses),
              narrowed by the search and track filter. */}
          <section aria-label={t.dashboard.recommendedForYou}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {t.dashboard.recommendedForYou}
              </h2>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center space-x-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-1"
              >
                <span>{t.common.viewAll}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            {coursesError && (
              <p className="text-sm font-medium text-rose-500">{coursesError}</p>
            )}

            {!coursesError && filteredCourses.length === 0 && (
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {courses.length === 0 ? t.dashboard.noCoursesYet : t.dashboard.noCoursesFound}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCourses.map((course) => (
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
