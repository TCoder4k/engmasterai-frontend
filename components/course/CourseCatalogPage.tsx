import React, { useEffect, useState } from 'react';
import StudentLayout from '../user/StudentLayout';
import CourseCard from '../user/CourseCard';
import EmptyState from '../shared/EmptyState';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { getPublishedCourses } from '../../services/courseService';
import { Course } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

// Full course catalog (/courses) — the dashboard's "Recommended for You"
// grid is a curated preview of this same GET /courses feed.
const CourseCatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublishedCourses()
      .then((res) => setCourses(res.data))
      .catch((err) => setError(err.message || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.course.catalogTitle}
          </h2>
          <div className="h-1 w-12 bg-indigo-500 mt-2.5 rounded-full"></div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-40 w-full" />
            ))}
          </div>
        )}

        {error && <ErrorState message={error} />}

        {!isLoading && !error && courses.length === 0 && (
          <EmptyState message={t.dashboard.noCoursesYet} />
        )}

        {!isLoading && !error && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default CourseCatalogPage;
