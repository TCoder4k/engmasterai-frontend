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
import { Course, Lesson } from '../../types';
import { ArrowLeft, BookOpen } from 'lucide-react';
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
    });
  }, [course]);

  return (
    <StudentLayout>
      <div className="max-w-5xl mx-auto">
        <Link
          to="/courses"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors mb-8 min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>{t.course.backToCourses}</span>
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
            <div className="mb-10">
              <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 uppercase">
                {t.tracks[TRACK_KEY[course.type]].label}
              </span>
              <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 mt-3">{course.title}</h2>
              <div className="h-1 w-12 bg-indigo-500 mt-2.5 mb-4 rounded-full"></div>
              <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium max-w-2xl">
                {course.description}
              </p>
            </div>

            {lessons.length === 0 && (
              <EmptyState icon={<BookOpen size={32} />} message={t.course.noLessonsYet} />
            )}

            <div className="space-y-3">
              {lessons.map((lesson, index) => (
                <LessonListItem key={lesson.id} courseId={course.id} lesson={lesson} orderNumber={index + 1} />
              ))}
            </div>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default CourseDetailPage;
