import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import LessonVideoPlayer from './video/LessonVideoPlayer';
import GrammarLessonContent from './grammar/GrammarLessonContent';
import LessonOutline from './grammar/LessonOutline';
import LessonStepper from './LessonStepper';
import LessonStageStepper from './LessonStageStepper';
import { VideoStageSidePanel, TheoryCompletionBar } from './LessonStageChrome';
import NextLessonCard from './NextLessonCard';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { getLesson, getCourseLessons } from '../../services/lessonService';
import { getPublishedCourse } from '../../services/courseService';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { recordRecentActivity } from '../../services/recentActivity';
import {
  LessonStageId,
  StageStatus,
  getStageStatus,
  markTheoryComplete,
} from '../../services/lessonProgress';
import { parseGrammarNotes, ParsedGrammarNotes } from './grammar/parseGrammarNotes';
import { Course, Lesson } from '../../types';
import { ArrowLeft, Clock } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const EMPTY_PARSED: ParsedGrammarNotes = { sections: [], fallbackText: null };

const isStageParam = (value: string | null): value is LessonStageId =>
  value === 'video' || value === 'theory';

// Shared Lesson/Grammar shell (design doc §7.5) — one route, one video
// player, one completion flow, content swapped by course.type. GET
// /lessons/:id does not return CourseType (confirmed gap, §7.5), so this
// page also fetches the parent course via the courseId route param —
// data it needs anyway for the back-link and course title.
//
// Sprint 06: for GRAMMAR courses this becomes a STAGED player matching the
// design reference — a five-tile stepper with Video and Theory as real,
// completable stages and Quiz/Trap Hunter/Advanced locked. Non-Grammar
// lessons keep the original single-scroll layout untouched, so Listening and
// Vocabulary do not inherit a flow built for grammar content.
const LessonPage: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [siblingLessons, setSiblingLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<any | null>(null);
  // Bumped whenever local stage state changes, so the stepper re-reads it.
  const [progressToken, setProgressToken] = useState(0);

  const userId = authService.getUser()?.id;

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
      // Sprint 05 — lets Continue Learning prioritise Grammar. This page
      // already fetches the parent course (GET /lessons/:id returns no
      // CourseType), so the module is known here without an extra request.
      courseType: course?.type,
    });
  }, [lesson, courseId, course]);

  const isGrammar = course?.type === 'GRAMMAR';
  const parsedNotes = useMemo(
    () => (isGrammar ? parseGrammarNotes(lesson?.notes) : EMPTY_PARSED),
    [isGrammar, lesson?.notes],
  );
  const hasNotesContent = isGrammar
    ? Boolean(parsedNotes.sections.length || parsedNotes.fallbackText)
    : Boolean(lesson?.notes?.trim());

  // Stage lives in the URL so a refresh, a bookmark and browser-back all
  // land where the student was.
  const stageParam = searchParams.get('stage');
  const currentStage: LessonStageId = isStageParam(stageParam) ? stageParam : 'video';

  const selectStage = useCallback(
    (stage: LessonStageId) => {
      const next = new URLSearchParams(searchParams);
      next.set('stage', stage);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const stageStatuses = useMemo((): Record<LessonStageId, StageStatus> => {
    const target = lesson ?? { id: '', videoUrl: null, notes: null };
    // progressToken is a deliberate dependency: local stage state lives in
    // localStorage, which React cannot observe on its own.
    void progressToken;
    return {
      video: getStageStatus(userId, target, 'video'),
      theory: getStageStatus(userId, target, 'theory'),
      quiz: getStageStatus(userId, target, 'quiz'),
      traphunter: getStageStatus(userId, target, 'traphunter'),
      practice: getStageStatus(userId, target, 'practice'),
    };
  }, [lesson, userId, progressToken]);

  const handleMarkTheoryRead = () => {
    if (!userId || !lesson) return;
    markTheoryComplete(userId, lesson.id);
    setProgressToken((token) => token + 1);
  };

  const goToTheory = () => {
    selectStage('theory');
    setProgressToken((token) => token + 1);
  };

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto">
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

        {!isLoading && !error && lesson && course && !isGrammar && (
          <div className="max-w-4xl">
            {/* Non-Grammar lessons keep the original single-scroll layout. */}
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

            {lesson.notes && lesson.notes.trim() && (
              <div className="mb-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm dark:border dark:border-slate-800 p-6">
                <p className="text-[14px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                  {lesson.notes}
                </p>
              </div>
            )}

            <NextLessonCard courseId={course.id} currentLesson={lesson} allLessons={siblingLessons} />
          </div>
        )}

        {!isLoading && !error && lesson && course && isGrammar && (
          <>
            {/* Lesson header bar — course chip + lesson title, matching the
                design reference's top bar. */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 mb-6 bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-2xl shadow-sm dark:shadow-xl">
              <div className="min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border dark:border-indigo-500/30">
                  {course.title}
                </span>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate mt-1">
                  {lesson.title}
                </h1>
              </div>
              {lesson.videoDurationMinutes && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 flex-shrink-0">
                  <Clock size={12} aria-hidden="true" />
                  {lesson.videoDurationMinutes} {t.lesson.minutesUnit}
                </span>
              )}
            </div>

            <LessonStageStepper
              currentStage={currentStage}
              statuses={stageStatuses}
              onSelectStage={selectStage}
            />

            {currentStage === 'video' && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 mb-8">
                <div className="space-y-5">
                  <LessonVideoPlayer
                    courseId={course.id}
                    lessonId={lesson.id}
                    resolvedLessonPath={`/courses/${course.id}/lessons/${lesson.id}`}
                    videoUrl={lesson.videoUrl}
                    onPlayerReady={setPlayer}
                    onEnded={() => setProgressToken((token) => token + 1)}
                  />

                  {(lesson.description || lesson.learningObjectives.length > 0) && (
                    <section className="bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-2xl p-5 shadow-sm dark:shadow-xl">
                      <h2 className="text-sm font-black text-slate-900 dark:text-white mb-2">
                        {t.lesson.objectivesTitle}
                      </h2>
                      {lesson.description && (
                        <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                          {lesson.description}
                        </p>
                      )}
                      {lesson.learningObjectives.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
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
                    </section>
                  )}
                </div>

                <VideoStageSidePanel
                  lesson={lesson}
                  parsed={parsedNotes}
                  player={player}
                  onGoToTheory={goToTheory}
                />
              </div>
            )}

            {currentStage === 'theory' && (
              <div className="space-y-5 mb-8">
                {parsedNotes.sections.length > 0 && <LessonOutline sections={parsedNotes.sections} />}
                <GrammarLessonContent parsed={parsedNotes} />
                {hasNotesContent && (
                  <TheoryCompletionBar
                    isComplete={stageStatuses.theory === 'completed'}
                    onMarkRead={handleMarkTheoryRead}
                  />
                )}
              </div>
            )}

            <NextLessonCard courseId={course.id} currentLesson={lesson} allLessons={siblingLessons} />
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default LessonPage;
