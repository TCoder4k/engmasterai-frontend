import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Lesson } from '../../../types';
import {
  answerQuizQuestion,
  getLessonQuiz,
  startLessonQuiz,
  submitLessonQuiz,
  AnswerQuestionResponse,
  StudentQuiz,
  StudentQuizQuestion,
  SubmitQuizResponse,
  SubmittedAnswer,
} from '../../../services/quizService';
import { readQuizDraft, writeQuizDraft, clearQuizDraft, QuizDraft } from '../../../services/quizDraft';
import { ApiError, handleAuthError } from '../../../services/apiError';
import { playSelect, playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import { useTranslation } from '../../../i18n/useTranslation';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { SlideLeft } from '../../shared/motion';
import QuizProgressBar from './QuizProgressBar';
import QuizQuestionCard from './QuizQuestionCard';
import QuizFeedbackPanel from './QuizFeedbackPanel';
import QuizSummary from './QuizSummary';
import LessonCompletePanel from './LessonCompletePanel';

interface QuizStageProps {
  lessonId: string;
  courseId: string;
  currentLesson: Lesson;
  allLessons: Lesson[];
  userId: string | undefined;
  // Lets LessonPage keep the stage stepper's 'quiz' tile in sync without
  // this component knowing anything about the stepper itself.
  onProgressChange?: (progress: { passed: boolean; attemptsCount: number }) => void;
  // Sprint 06C — how to reach the correction round. This component decides
  // WHETHER to offer it (only when the finished attempt actually has wrong
  // answers) and LessonPage decides what "going there" means, so QuizStage
  // still knows nothing about stages or routing.
  onGoToTrapHunter?: () => void;
}

type Phase = 'loading' | 'error' | 'answering' | 'submitting' | 'summary' | 'complete';

// A question's server verdict, kept per question id so navigating back to an
// already-answered question shows its recorded feedback rather than an
// editable input.
type GradedMap = Record<string, AnswerQuestionResponse>;

// The Lesson Quiz Engine's student-facing orchestrator. Deliberately knows
// nothing about Grammar (or any subject) — see docs/sprints/
// sprint-06B-lesson-quiz-engine.md's governing principle. Everything it
// touches (StudentQuizQuestion, grading, progress) is generic; only the
// lesson content itself (fetched by lessonId) determines the subject.
//
// Sprint 06B.5 — supports two flows, chosen by the QUIZ (never by course
// type):
//   IMMEDIATE  answer → server grades that one question → feedback + reveal
//              → next. The question locks once graded.
//   ON_SUBMIT  the original Sprint 06B flow: answer everything, submit once.
const QuizStage: React.FC<QuizStageProps> = ({
  lessonId,
  courseId,
  currentLesson,
  allLessons,
  userId,
  onProgressChange,
  onGoToTrapHunter,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<StudentQuiz | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitQuizResponse | null>(null);

  const [answers, setAnswers] = useState<Record<string, SubmittedAnswer>>({});
  const [graded, setGraded] = useState<GradedMap>({});
  const [checking, setChecking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [clientAttemptId, setClientAttemptId] = useState<string>('');
  const [burstKey, setBurstKey] = useState(0);

  // +1 forward / -1 back, so the card exits and enters on the correct side.
  // A ref, not state: it must be read during the same render that changes
  // the index, and it should never itself trigger one.
  const directionRef = useRef<1 | -1>(1);

  // Sprint 07 — `forceStart` is the "Thử lại" path: a student with a stored
  // result sees it first, and only an explicit retry begins a new attempt.
  const loadQuiz = useCallback(
    (forceStart = false) => {
    setPhase('loading');
    setLoadError(null);
    getLessonQuiz(lessonId)
      .then(async (res) => {
        // ---- Sprint 07: decide whether to resume, summarise, or start -----
        //
        // This used to end unconditionally with `setSubmitResult(null);
        // setPhase('answering')`, with no branch on what the server had
        // already recorded. Reopening a passed quiz therefore always dropped
        // the student into a blank question 1 and discarded the stored result,
        // which arrived in `res.progress` and was simply never rendered.
        const hasInFlightAttempt = Boolean(res.quiz.currentAttemptId);

        if (!hasInFlightAttempt && !forceStart && res.lastResult) {
          // Finished before, and not retrying: show what they scored. Nothing
          // is started, so leaving the page again costs them nothing.
          setQuiz(res.quiz);
          onProgressChange?.(res.progress);
          setSubmitResult(res.lastResult);
          setPhase('summary');
          return;
        }

        if (!hasInFlightAttempt) {
          // A true first attempt (or an explicit retry). Started here rather
          // than behind an intro screen, so the common case — a student
          // opening a quiz they have never taken — costs no extra click.
          res = await startLessonQuiz(lessonId);
        }

        setQuiz(res.quiz);
        onProgressChange?.(res.progress);

        // Questions already answered in this attempt come back from the
        // SERVER, not from sessionStorage — a refresh restores real graded
        // state, and an unanswered question still carries no answer at all.
        const restoredAnswers: Record<string, SubmittedAnswer> = {};
        const restoredGraded: GradedMap = {};
        const answeredIds = res.quiz.questions.filter((q) => q.answered);
        answeredIds.forEach((q, i) => {
          if (!q.answered) return;
          if (q.answered.submitted) restoredAnswers[q.id] = q.answered.submitted;
          restoredGraded[q.id] = {
            questionId: q.id,
            isCorrect: q.answered.isCorrect,
            correctAnswer: q.answered.correctAnswer,
            explanation: q.answered.explanation,
            answeredCount: answeredIds.length,
            totalCount: res.quiz.questions.length,
            // Not recomputed client-side: a restored view shows the verdict
            // and the explanation, and the streak badge simply doesn't
            // reappear rather than being invented here.
            currentStreak: 0,
            allAnswered: answeredIds.length >= res.quiz.questions.length && i >= 0,
          };
        });

        // The draft still carries un-graded typing (and the position), which
        // the server has no reason to know about.
        const draft = userId ? readQuizDraft(userId, lessonId) : null;
        const draftAnswers = draft?.answers ?? {};

        setAnswers({ ...draftAnswers, ...restoredAnswers });
        setGraded(restoredGraded);
        // The server's in-flight attempt id WINS over the draft's. Losing the
        // sessionStorage draft (new tab, restored session, cleared storage)
        // used to mint a fresh id here, and the answer endpoint treats an
        // unrecognised id as a retake — so the answers already recorded were
        // silently dropped and submit then rejected the attempt as
        // incomplete for questions the student had visibly answered.
        setClientAttemptId(
          res.quiz.currentAttemptId ?? draft?.clientAttemptId ?? crypto.randomUUID(),
        );

        // Resume at the first unanswered question, falling back to the
        // draft's position for an ON_SUBMIT quiz (which grades nothing yet).
        const firstUnanswered = res.quiz.questions.findIndex((q) => !q.answered);
        const resumeIndex =
          res.quiz.feedbackMode === 'IMMEDIATE' && firstUnanswered >= 0
            ? firstUnanswered
            : Math.min(draft?.currentIndex ?? 0, res.quiz.questions.length - 1);
        setCurrentIndex(Math.max(0, resumeIndex));

        setSubmitResult(null);
        setPhase('answering');
      })
      .catch((err) => {
        setLoadError(handleAuthError(err, navigate) || t.quiz.loadFailed);
        setPhase('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [lessonId, userId],
  );

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // Draft persistence — position and un-graded typing only. Graded answers
  // live server-side; nothing about correctness is ever written here.
  useEffect(() => {
    if (!userId || phase !== 'answering' || !clientAttemptId) return;
    const draft: QuizDraft = { clientAttemptId, answers, currentIndex };
    writeQuizDraft(userId, lessonId, draft);
  }, [userId, lessonId, phase, clientAttemptId, answers, currentIndex]);

  if (phase === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (phase === 'error' || !quiz) {
    return <ErrorState message={loadError ?? t.quiz.loadFailed} onRetry={loadQuiz} />;
  }

  const isImmediate = quiz.feedbackMode === 'IMMEDIATE';
  const totalQuestions = quiz.questions.length;
  const currentQuestion: StudentQuizQuestion | undefined = quiz.questions[currentIndex];
  const currentValue = currentQuestion ? (answers[currentQuestion.id] ?? null) : null;
  const currentGraded = currentQuestion ? (graded[currentQuestion.id] ?? null) : null;
  const answeredCount = isImmediate
    ? Object.keys(graded).length
    : quiz.questions.filter((q) => answers[q.id] != null).length;
  const canProceed = currentValue !== null;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const allGraded = isImmediate && Object.keys(graded).length >= totalQuestions;

  const handleAnswerChange = (value: SubmittedAnswer) => {
    if (!currentQuestion || currentGraded) return;
    // Acknowledges the CHOICE, not its correctness — which the client
    // genuinely does not know yet. Deliberately not playCorrect.
    playSelect();
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  // IMMEDIATE only — grade this one question server-side and reveal.
  const handleCheck = () => {
    if (!currentQuestion || !currentValue || currentGraded || checking) return;
    setChecking(true);
    setSubmitError(null);
    answerQuizQuestion(lessonId, {
      clientAttemptId,
      questionId: currentQuestion.id,
      submitted: currentValue,
    })
      .then((result) => {
        setGraded((prev) => ({ ...prev, [result.questionId]: result }));
        if (result.isCorrect) {
          playCorrect();
          setBurstKey((k) => k + 1);
        } else {
          playIncorrect();
        }
      })
      .catch((err) => {
        setSubmitError(handleAuthError(err, navigate) || t.quiz.checkFailed);
      })
      .finally(() => setChecking(false));
  };

  const handleSubmit = () => {
    if (!userId) return;
    setPhase('submitting');
    setSubmitError(null);
    submitLessonQuiz(lessonId, {
      clientAttemptId,
      // Under IMMEDIATE the server scores from its own record and ignores
      // anything sent here, so there is nothing to send.
      ...(isImmediate
        ? {}
        : {
            answers: Object.entries(answers).map(([questionId, submitted]) => ({
              questionId,
              submitted,
            })),
          }),
    })
      .then((result) => {
        setSubmitResult(result);
        clearQuizDraft(userId, lessonId);
        onProgressChange?.({ passed: result.passed, attemptsCount: result.attemptsCount });
        setPhase('summary');
      })
      .catch((err) => {
        const message = handleAuthError(err, navigate) || t.quiz.submitFailed;

        // The server's record is the only authority on what has been
        // answered, so a 400 here means the two views disagree. Re-syncing
        // from the server (which also lands the student on the first
        // genuinely unanswered question) turns a dead end into a next step —
        // previously this left a raw backend string on screen with no way
        // forward but a full retake.
        if (isImmediate && err instanceof ApiError && err.status === 400) {
          setSubmitError(t.quiz.finishBlocked);
          loadQuiz();
          return;
        }

        setSubmitError(message);
        setPhase('answering'); // draft is untouched — nothing was lost
      });
  };

  const handleNext = () => {
    if (isImmediate) {
      // Under immediate feedback the primary button has three jobs in
      // sequence: check this answer, move on, or finish the attempt.
      if (!currentGraded) return handleCheck();
      if (allGraded && isLastQuestion) return handleSubmit();
      if (isLastQuestion) {
        // Some earlier question is still unanswered — go back to it rather
        // than letting the student hit a 400 from submit.
        const firstUngraded = quiz.questions.findIndex((q) => !graded[q.id]);
        if (firstUngraded >= 0) {
          directionRef.current = firstUngraded > currentIndex ? 1 : -1;
          setCurrentIndex(firstUngraded);
        }
        return;
      }
      directionRef.current = 1;
      setCurrentIndex((i) => i + 1);
      return;
    }

    if (!canProceed) return;
    if (isLastQuestion) {
      handleSubmit();
    } else {
      directionRef.current = 1;
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePrevious = () => {
    directionRef.current = -1;
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  // Sprint 07 — the ONLY thing that begins a new attempt once a stored result
  // exists. Passing forceStart skips the summary branch in loadQuiz, so the
  // student sees what they scored first and chooses to go again.
  //
  // The previous attempt is not destroyed: the server keeps every finished
  // attempt in its append-only history, and `completedAt`, best score and
  // attempt count all survive a worse retry.
  const handleRetake = () => {
    if (userId) clearQuizDraft(userId, lessonId);
    setGraded({});
    loadQuiz(true); // re-fetches — ORDERING options get a fresh server-side shuffle
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || phase !== 'answering') return;
    if (checking) return;
    // Enter means "the obvious next thing": check, advance, or finish.
    if (isImmediate ? !currentValue && !currentGraded : !canProceed) return;
    e.preventDefault();
    handleNext();
  };

  const primaryLabel = (): string => {
    if (checking) return t.quiz.checkingAction;
    if (phase === 'submitting') return t.common.loading;
    if (!isImmediate) return isLastQuestion ? t.quiz.submitAction : t.common.next;
    if (!currentGraded) return t.quiz.checkAction;
    if (allGraded && isLastQuestion) return t.quiz.finishAction;
    return t.quiz.nextQuestionAction;
  };

  const primaryDisabled =
    phase === 'submitting' ||
    checking ||
    (isImmediate ? !currentValue && !currentGraded : !canProceed);

  if (phase === 'summary' && submitResult) {
    return (
      <QuizSummary
        result={submitResult}
        questions={quiz.questions}
        onContinue={() => setPhase('complete')}
        onRetake={handleRetake}
        onGoToTrapHunter={onGoToTrapHunter}
      />
    );
  }

  if (phase === 'complete' && submitResult) {
    return (
      <LessonCompletePanel
        result={submitResult}
        courseId={courseId}
        currentLesson={currentLesson}
        allLessons={allLessons}
      />
    );
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <QuizProgressBar current={currentIndex} total={totalQuestions} answeredCount={answeredCount} />

      {/*
        mode="wait" so the outgoing question finishes leaving before the
        next arrives — without it the two cards overlap mid-transition and
        the layout jumps. The key is the question id (the card previously
        had no key at all, so React reused the same DOM node and no enter
        animation could ever retrigger).
      */}
      <AnimatePresence mode="wait" initial={false}>
        {currentQuestion && (
          <SlideLeft key={currentQuestion.id} direction={directionRef.current}>
            <QuizQuestionCard
              question={currentQuestion}
              index={currentIndex}
              total={totalQuestions}
              value={currentValue}
              onChange={handleAnswerChange}
              onEnter={handleNext}
              graded={currentGraded}
            />
            {currentGraded && (
              <QuizFeedbackPanel feedback={currentGraded} burstKey={burstKey} />
            )}
          </SlideLeft>
        )}
      </AnimatePresence>

      {submitError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-between mt-5">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {t.common.previous}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={primaryDisabled}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {primaryLabel()}
          {phase !== 'submitting' && !checking && !isLastQuestion && (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="mt-4 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
        {t.quiz.keyboardHint}
      </p>
    </div>
  );
};

export default QuizStage;
