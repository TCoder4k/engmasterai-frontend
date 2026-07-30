import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { SlideUp } from '../shared/motion';
import StudentLayout from '../user/StudentLayout';
import LessonVideoPlayer from './video/LessonVideoPlayer';
import GrammarTheoryCards from './grammar/GrammarTheoryCards';
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
  LessonProgressSnapshot,
  StageStatus,
  getStageStatus,
  lessonHasQuiz,
} from '../../services/lessonProgress';
import {
  completeTheory,
  getLessonProgress,
  startTheory,
} from '../../services/progressService';
import { parseGrammarNotes, ParsedGrammarNotes } from './grammar/parseGrammarNotes';
import QuizStage from './quiz/QuizStage';
import TrapHunterStage from './traphunter/TrapHunterStage';
import AdvancedPracticeStage from './practice/AdvancedPracticeStage';
import { Course, Lesson } from '../../types';
import { ArrowLeft, Clock } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const EMPTY_PARSED: ParsedGrammarNotes = { sections: [], fallbackText: null };

// Sprint 06B — 'quiz' joins the set of stages this page can actually mount.
// Sprint 06C — and 'traphunter'. Sprint 06D — and 'practice', the last of
// the five. Every stage now has a real module behind it, so every one of
// them is a legitimate ?stage= value; the fallback below still catches the
// cases where a named stage has nothing to render for THIS lesson.
const isStageParam = (value: string | null): value is LessonStageId =>
  value === 'video' ||
  value === 'theory' ||
  value === 'quiz' ||
  value === 'traphunter' ||
  value === 'practice';

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
  // Sprint 07 — ONE server-side snapshot covering every stage, replacing the
  // three separate progress states and the localStorage reads that used to
  // stand in for video and theory.
  //
  // Undefined means "not fetched yet", which getStageStatus reports as the
  // honest not-started/blocked rather than a fabricated completion.
  const [progress, setProgress] = useState<LessonProgressSnapshot | undefined>(undefined);
  // Sprint 07 — held separately from `isLoading` so the STEPPER can wait for
  // real progress while the video and title render immediately. Without this
  // the stepper painted once with everything unfetched and then snapped, and
  // LessonStageStepper springs on `status`, so the correction was a visible
  // pop rather than a quiet fill-in.
  const [isProgressLoading, setIsProgressLoading] = useState(true);

  const userId = authService.getUser()?.id;

  useEffect(() => {
    if (!courseId || !lessonId) return;
    // Sprint 07 — every effect on this page now guards its own writes.
    // Without this, navigating lesson-to-lesson (same route, new params) let a
    // slow response for lesson A land after lesson B had mounted and overwrite
    // B's state with A's. UserHome and GrammarRoadmapPage already did this.
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([getLesson(lessonId), getPublishedCourse(courseId), getCourseLessons(courseId)])
      .then(([lessonRes, courseRes, lessonsRes]) => {
        if (cancelled) return;
        setLesson(lessonRes);
        setCourse(courseRes);
        setSiblingLessons(lessonsRes.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(handleAuthError(err, navigate) || t.common.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId]);

  // Sprint 07 — the ONE progress request.
  //
  // This replaces three page-level calls (trap hunter, practice, and a quiz
  // call that was never actually made) plus two localStorage reads. The
  // missing quiz call was the H1 bug: `quizProgress` only ever arrived through
  // QuizStage's callback, and QuizStage mounts only when the quiz tab is open
  // — so a passed quiz read "Chưa học" in the stepper, and Advanced Practice
  // read "Hoàn thành Quiz trước", until the student happened to open the quiz.
  // The same lesson simultaneously read "Đã hoàn thành" on the course page.
  //
  // Safe to call on every visit precisely because it is read-only.
  const refreshProgress = useCallback(async () => {
    if (!lessonId || !userId) {
      setIsProgressLoading(false);
      return;
    }
    try {
      setProgress(await getLessonProgress(lessonId));
    } catch {
      // Left undefined, which every stage reports as not-started/blocked —
      // never a fabricated completion.
      setProgress(undefined);
    } finally {
      setIsProgressLoading(false);
    }
  }, [lessonId, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!lessonId || !userId) {
      setIsProgressLoading(false);
      return;
    }
    setIsProgressLoading(true);
    getLessonProgress(lessonId)
      .then((res) => {
        if (!cancelled) setProgress(res);
      })
      .catch(() => {
        if (!cancelled) setProgress(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsProgressLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, userId]);

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
  const requestedStage: LessonStageId = isStageParam(stageParam) ? stageParam : 'video';

  const selectStage = useCallback(
    (stage: LessonStageId) => {
      const next = new URLSearchParams(searchParams);
      next.set('stage', stage);
      setSearchParams(next, { replace: false });
      // Sprint 06B.5 — a stage swap replaces the whole content area, so
      // without this the student can land mid-way down the new stage at
      // whatever scroll offset the previous one left behind. Smooth rather
      // than instant so the movement is legible; the browser downgrades
      // this to a jump on its own under prefers-reduced-motion.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, setSearchParams],
  );

  // Sprint 07 — every tile derives from the one server snapshot. No
  // progressToken, because there is no longer any local state for React to
  // fail to observe: a stage completes by calling the server, and the page
  // re-reads the result.
  const stageStatuses = useMemo((): Record<LessonStageId, StageStatus> => {
    const target = lesson ?? { id: '', videoUrl: null, notes: null, publishedTaskTypes: [] };
    return {
      video: getStageStatus(userId, target, 'video', progress),
      theory: getStageStatus(userId, target, 'theory', progress),
      quiz: getStageStatus(userId, target, 'quiz', progress),
      traphunter: getStageStatus(userId, target, 'traphunter', progress),
      practice: getStageStatus(userId, target, 'practice', progress),
    };
  }, [lesson, userId, progress]);

  // A bookmarked/typed ?stage=quiz on a lesson with no quiz falls back to
  // Video rather than rendering nothing — the same thing an unrecognised
  // ?stage= value already did before Sprint 06B added 'quiz' to
  // isStageParam. Scoped to quiz only: 'theory' keeps its pre-existing
  // behavior untouched (it renders its own empty-state, never redirects)
  // per this sprint's "Theory must remain untouched" constraint.
  //
  // Sprint 06C extends the same rule to 'traphunter', but only for the two
  // statuses that mean "there is genuinely nothing to render here":
  // 'unavailable' (this lesson has no quiz) and 'skipped' (a perfect
  // attempt). 'blocked' deliberately still mounts — the stage explains why
  // it is closed and offers a way to the quiz, which is more use than a
  // silent redirect to the video.
  const currentStage: LessonStageId =
    (requestedStage === 'quiz' && stageStatuses.quiz === 'unavailable') ||
    (requestedStage === 'traphunter' &&
      (stageStatuses.traphunter === 'unavailable' || stageStatuses.traphunter === 'skipped')) ||
    // Sprint 06D — same rule, same exception: 'blocked' still mounts,
    // because PracticeIntro says WHICH prerequisite is missing and that is
    // more use than a silent redirect.
    (requestedStage === 'practice' && stageStatuses.practice === 'unavailable')
      ? 'video'
      : requestedStage;

  // Sprint 07 — the explicit "Tôi đã đọc xong" action, now a real server
  // write. PESSIMISTIC on purpose: the tile flips only after the server has
  // recorded it, because a completion that silently failed is exactly the
  // class of lie this sprint exists to remove.
  const [isMarkingTheory, setIsMarkingTheory] = useState(false);
  const [theoryError, setTheoryError] = useState<string | null>(null);

  const handleMarkTheoryRead = async () => {
    if (!userId || !lesson || isMarkingTheory) return;
    setIsMarkingTheory(true);
    setTheoryError(null);
    try {
      await completeTheory(lesson.id);
      await refreshProgress();
    } catch (err) {
      setTheoryError(handleAuthError(err, navigate) || t.common.loadFailed);
    } finally {
      setIsMarkingTheory(false);
    }
  };

  // Opening the theory pane marks it IN_PROGRESS — never completed. An
  // accidental visit must not claim a student has read something.
  // Fire-and-forget: this is a hint for the stepper, not a gate on anything.
  useEffect(() => {
    if (currentStage !== 'theory' || !lesson || !userId || !hasNotesContent) return;
    if (progress?.steps?.theory?.startedAt) return;
    void startTheory(lesson.id)
      .then(() => refreshProgress())
      .catch(() => {
        // Silent by design — failing to record that a pane was opened is not
        // worth interrupting the student to report.
      });
  }, [currentStage, lesson, userId, hasNotesContent, progress, refreshProgress]);

  const goToTheory = () => {
    selectStage('theory');
  };

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto">
        <Link
          to={courseId ? `/courses/${courseId}` : '/courses'}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors mb-8 min-h-[44px]"
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
                    <span className="text-blue-400 mt-1" aria-hidden="true">
                      •
                    </span>
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mb-6">
              <LessonVideoPlayer
                lessonId={lesson.id}
                videoUrl={lesson.videoUrl}
                savedProgress={progress?.steps?.video}
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
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 dark:border dark:border-blue-500/30">
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

            {/* Sprint 07 — held back until real progress arrives. The tiles
                used to paint once with everything unfetched (every stage
                "Chưa học", Practice "Hoàn thành Quiz trước") and then snap to
                the truth, and the stepper springs on `status`, so the
                correction read as a visible pop rather than a quiet fill-in.
                A skeleton says "loading" honestly instead. */}
            {isProgressLoading ? (
              <div className="mb-6" aria-hidden="true">
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : (
              <LessonStageStepper
                currentStage={currentStage}
                statuses={stageStatuses}
                onSelectStage={selectStage}
              />
            )}

            {/*
              Sprint 06B.5 — the three stages were sibling short-circuits
              with no wrapper and no key, so switching stages unmounted one
              subtree and mounted an unrelated one in the same frame.
              AnimatePresence keyed on the stage gives a crossfade instead.
              mode="wait" keeps the outgoing stage from overlapping the
              incoming one, which would otherwise double the page height
              mid-transition.
            */}
            <AnimatePresence mode="wait" initial={false}>
              <SlideUp key={currentStage}>
            {currentStage === 'video' && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 mb-8">
                <div className="space-y-5">
                  <LessonVideoPlayer
                    lessonId={lesson.id}
                    videoUrl={lesson.videoUrl}
                    savedProgress={progress?.steps?.video}
                    onPlayerReady={setPlayer}
                    // Sprint 07 — the player flushes the final position to the
                    // server BEFORE calling this, so the re-read sees the
                    // completed step rather than racing the write.
                    onEnded={() => void refreshProgress()}
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
                              <span className="text-blue-400 mt-1" aria-hidden="true">
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
                <GrammarTheoryCards parsed={parsedNotes} />
                {hasNotesContent && (
                  <TheoryCompletionBar
                    isComplete={stageStatuses.theory === 'completed'}
                    onMarkRead={handleMarkTheoryRead}
                    isPending={isMarkingTheory}
                    error={theoryError}
                    hasQuiz={lessonHasQuiz(lesson)}
                    onGoToQuiz={() => selectStage('quiz')}
                  />
                )}
              </div>
            )}

            {/* Sprint 06B — subject-agnostic engine, Grammar-only mount
                point: matches Sprint 06's existing rule that the staged
                player (and everything in it) only replaces the flow for
                GRAMMAR courses. QuizStage renders its own NextLessonCard
                once the attempt reaches Lesson Complete, so the page's own
                trailing one below is suppressed for this stage only —
                otherwise the two would stack. */}
            {currentStage === 'quiz' && lessonHasQuiz(lesson) && userId && (
              <div className="mb-8">
                <QuizStage
                  lessonId={lesson.id}
                  courseId={course.id}
                  currentLesson={lesson}
                  allLessons={siblingLessons}
                  userId={userId}
                  onProgressChange={() => void refreshProgress()}
                  onGoToTrapHunter={() => selectStage('traphunter')}
                />
              </div>
            )}

            {/* Sprint 06C — driven by the student's own recorded mistakes,
                so it mounts on exactly the same terms as the quiz: any
                lesson with a published quiz. Nothing about it is
                Grammar-specific; only this page's own Sprint 06 rule
                (staged player for GRAMMAR courses) decides where the staged
                flow appears at all. */}
            {currentStage === 'traphunter' && lessonHasQuiz(lesson) && userId && (
              <div className="mb-8">
                <TrapHunterStage
                  lessonId={lesson.id}
                  onProgressChange={() => void refreshProgress()}
                  onGoToQuiz={() => selectStage('quiz')}
                />
              </div>
            )}

            {/* Sprint 06D — Advanced Practice. Mounted for any lesson with a
                published practice task; the stage itself renders the intro,
                the blocked explanation or the questions depending on what
                the server reports. */}
            {currentStage === 'practice' && userId && (
              <div className="mb-8">
                <AdvancedPracticeStage
                  lessonId={lesson.id}
                  onCompleted={() => void refreshProgress()}
                />
              </div>
            )}
              </SlideUp>
            </AnimatePresence>

            {currentStage !== 'quiz' && (
              <NextLessonCard courseId={course.id} currentLesson={lesson} allLessons={siblingLessons} />
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default LessonPage;
