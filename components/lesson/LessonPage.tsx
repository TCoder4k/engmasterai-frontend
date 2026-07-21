import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import LessonVideoPlayer from './video/LessonVideoPlayer';
import GrammarLessonContent from './grammar/GrammarLessonContent';
import LessonOutline from './grammar/LessonOutline';
import LessonStepper from './LessonStepper';
import NextLessonCard from './NextLessonCard';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { getLesson, getCourseLessons } from '../../services/lessonService';
import { getPublishedCourse } from '../../services/courseService';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { recordRecentActivity } from '../../services/recentActivity';
import { parseGrammarNotes, ParsedGrammarNotes } from './grammar/parseGrammarNotes';
import { Course, Lesson } from '../../types';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const EMPTY_PARSED: ParsedGrammarNotes = { sections: [], fallbackText: null };

// Shared Lesson/Grammar shell (design doc §7.5) — one route, one video
// player, one completion flow, content swapped by course.type. GET
// /lessons/:id does not return CourseType (confirmed gap, §7.5), so this
// page also fetches the parent course via the courseId route param —
// data it needs anyway for the back-link and course title.
const LessonPage: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [siblingLessons, setSiblingLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    setIsLoading(true);
    setError(null);
    Promise.all([getLesson(lessonId), getPublishedCourse(courseId), getCourseLessons(courseId)])
      .then(([lessonRes, courseRes, lessonsRes]) => {
        setLesson(lessonRes);
        setCourse(courseRes);
        setSiblingLessons(lessonsRes.data);
      })
      .catch((err) => setError(handleAuthError(err, navigate) || t.common.loadFailed))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!lesson || !courseId) return;
    const user = authService.getUser();
    if (!user) return;
    recordRecentActivity(user.id, {
      type: 'lesson',
      id: lesson.id,
      title: lesson.title,
      path: `/courses/${courseId}/lessons/${lesson.id}`,
    });
  }, [lesson, courseId]);

  const isGrammar = course?.type === 'GRAMMAR';
  const parsedNotes = useMemo(
    () => (isGrammar ? parseGrammarNotes(lesson?.notes) : EMPTY_PARSED),
    [isGrammar, lesson?.notes],
  );
  const hasNotesContent = isGrammar
    ? Boolean(parsedNotes.sections.length || parsedNotes.fallbackText)
    : Boolean(lesson?.notes?.trim());

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto">
        <Link
          to={courseId ? `/courses/${courseId}` : '/courses'}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors mb-8 min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>{t.lesson.backToCourse}</span>
        </Link>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="aspect-video w-full" />
          </div>
        )}

        {error && <ErrorState message={error} />}

        {!isLoading && !error && lesson && course && (
          <>
            <LessonStepper hasNotes={hasNotesContent} />

            <h1 className="text-[22px] font-black text-slate-900 dark:text-slate-100 mb-1">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium mb-4">{lesson.description}</p>
            )}

            {lesson.learningObjectives.length > 0 && (
              <ul className="mb-6 space-y-1.5">
                {lesson.learningObjectives.map((objective, index) => (
                  <li
                    key={index}
                    className="text-[14px] text-slate-600 dark:text-slate-300 font-medium flex items-start gap-2"
                  >
                    <span className="text-indigo-400 mt-1" aria-hidden="true">
                      •
                    </span>
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mb-6">
              <LessonVideoPlayer
                courseId={course.id}
                lessonId={lesson.id}
                resolvedLessonPath={`/courses/${course.id}/lessons/${lesson.id}`}
                videoUrl={lesson.videoUrl}
              />
            </div>

            {isGrammar ? (
              <>
                {parsedNotes.sections.length > 0 && (
                  <div className="mb-4">
                    <LessonOutline sections={parsedNotes.sections} />
                  </div>
                )}
                <div className="mb-8">
                  <GrammarLessonContent parsed={parsedNotes} />
                </div>
              </>
            ) : (
              lesson.notes &&
              lesson.notes.trim() && (
                <div className="mb-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm dark:border dark:border-slate-800 p-6">
                  <p className="text-[14px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                    {lesson.notes}
                  </p>
                </div>
              )
            )}

            <NextLessonCard courseId={course.id} currentLesson={lesson} allLessons={siblingLessons} />
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default LessonPage;
