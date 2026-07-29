import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  AnswerQuestionResponse,
  StudentQuiz,
  StudentQuizQuestion,
  SubmitQuizResponse,
  SubmittedAnswer,
} from '../../../services/quizService';
import {
  answerPracticeQuestion,
  getPractice,
  startPractice,
  submitPractice,
  GetPracticeResponse,
} from '../../../services/practiceService';
import { ApiError, handleAuthError } from '../../../services/apiError';
import { playSelect, playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import { useTranslation } from '../../../i18n/useTranslation';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { SlideLeft } from '../../shared/motion';
import QuizProgressBar from '../quiz/QuizProgressBar';
import QuizQuestionCard from '../quiz/QuizQuestionCard';
import QuizFeedbackPanel from '../quiz/QuizFeedbackPanel';
import QuizSummary from '../quiz/QuizSummary';
import PracticeIntro from './PracticeIntro';

interface AdvancedPracticeStageProps {
  lessonId: string;
  onCompleted?: () => void;
}

// Sprint 06D — Advanced Practice.
//
// COMPOSED, NOT COPIED. The question inputs, the progress bar, the feedback
// panel and the whole summary screen are the quiz engine's, reused verbatim:
// Advanced Practice differs from the quiz in WHICH task it grades and WHEN it
// may be entered, not in how a multiple-choice question looks or how a score
// is presented. QuizSummary in particular already shows correct/incorrect/
// accuracy plus the three real stored numbers and an incorrect-answer recap,
// which is exactly this stage's summary requirement — writing a parallel one
// would have been ~200 duplicated lines that could drift.
//
// This component is subject-agnostic: it never reads the course or lesson
// subject, and understands only tasks, questions, answers and grades. That is
// enforced, not merely intended — see practiceIsGeneric.test.ts, which fails
// on any subject name appearing anywhere in this directory (including, as it
// turns out, in a comment claiming independence from them).
const AdvancedPracticeStage: React.FC<AdvancedPracticeStageProps> = ({
  lessonId,
  onCompleted,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const copy = t.lesson.practice;

  const [overview, setOverview] = useState<GetPracticeResponse | null>(null);
  const [attempt, setAttempt] = useState<StudentQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SubmittedAnswer>>({});
  const [graded, setGraded] = useState<Record<string, AnswerQuestionResponse>>({});
  const [feedback, setFeedback] = useState<AnswerQuestionResponse | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const directionRef = useRef<1 | -1>(1);
  const attemptIdRef = useRef<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPractice(lessonId);
      setOverview(res);
      // Resume: an attempt already in flight comes back from the read, so a
      // refresh mid-practice lands the student back where they were rather
      // than on the intro screen.
      if (res.attempt) {
        setAttempt(res.attempt);
        attemptIdRef.current = res.attempt.currentAttemptId ?? crypto.randomUUID();
        const restored: Record<string, SubmittedAnswer> = {};
        const restoredGrades: Record<string, AnswerQuestionResponse> = {};
        res.attempt.questions.forEach((question) => {
          if (question.answered) {
            restored[question.id] = question.answered.submitted as SubmittedAnswer;
            restoredGrades[question.id] = {
              questionId: question.id,
              isCorrect: question.answered.isCorrect,
              correctAnswer: question.answered.correctAnswer,
              explanation: question.answered.explanation,
              answeredCount: 0,
              totalCount: res.attempt?.questions.length ?? 0,
              currentStreak: 0,
              allAnswered: false,
            };
          }
        });
        setAnswers(restored);
        setGraded(restoredGrades);
      }
    } catch (err) {
      if (handleAuthError(err, navigate)) return;
      setError(err instanceof ApiError ? err.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [lessonId, copy.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await startPractice(lessonId);
      setAttempt(res.attempt);
      attemptIdRef.current = res.attempt.currentAttemptId ?? crypto.randomUUID();
      setIndex(0);
      setAnswers({});
      setGraded({});
      setFeedback(null);
      setResult(null);
    } catch (err) {
      if (handleAuthError(err, navigate)) return;
      setError(err instanceof ApiError ? err.message : copy.startFailed);
    } finally {
      setStarting(false);
    }
  };

  const questions: StudentQuizQuestion[] = attempt?.questions ?? [];
  const current = questions[index];
  const isImmediate = attempt?.feedbackMode === 'IMMEDIATE';

  const handleChange = (value: SubmittedAnswer) => {
    if (!current) return;
    if (isImmediate && graded[current.id]) return; // locked once graded
    playSelect();
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  };

  // IMMEDIATE mode: grade this one question server-side, then reveal.
  const handleGrade = async () => {
    if (!current || !answers[current.id] || graded[current.id]) return;
    try {
      const res = await answerPracticeQuestion(lessonId, {
        questionId: current.id,
        clientAttemptId: attemptIdRef.current,
        submitted: answers[current.id],
      });
      setGraded((prev) => ({ ...prev, [current.id]: res }));
      setFeedback(res);
      setBurstKey((k) => k + 1);
      if (res.isCorrect) playCorrect();
      else playIncorrect();
    } catch (err) {
      if (handleAuthError(err, navigate)) return;
      setError(err instanceof ApiError ? err.message : copy.answerFailed);
    }
  };

  const handleSubmit = async () => {
    if (!attempt) return;
    setSubmitting(true);
    try {
      const res = await submitPractice(lessonId, {
        clientAttemptId: attemptIdRef.current,
        // Under IMMEDIATE the server ignores this and scores from its own
        // record — see the quiz engine. Sent for ON_SUBMIT, where it is the
        // only source.
        answers: questions.map((question) => ({
          questionId: question.id,
          submitted: answers[question.id] ?? null,
        })),
      });
      setResult(res);
      if (res.passed) onCompleted?.();
    } catch (err) {
      if (handleAuthError(err, navigate)) return;
      setError(err instanceof ApiError ? err.message : copy.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    setFeedback(null);
    if (index < questions.length - 1) {
      directionRef.current = 1;
      setIndex((i) => i + 1);
    } else {
      void handleSubmit();
    }
  };

  const goPrev = () => {
    if (index === 0) return;
    directionRef.current = -1;
    setFeedback(null);
    setIndex((i) => i - 1);
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (error && !attempt) return <ErrorState message={error} onRetry={() => void load()} />;

  // Summary — the quiz's own, reused. Retry sends the student back through
  // the intro, which is also where a fresh attempt is started.
  if (result) {
    return (
      <QuizSummary
        result={result}
        questions={questions}
        onContinue={() => {
          setResult(null);
          setAttempt(null);
          void load();
        }}
        onRetake={() => {
          setResult(null);
          setAttempt(null);
          void load();
        }}
      />
    );
  }

  // No attempt in flight: the intro. Nothing here has started anything.
  if (!attempt || !overview) {
    return (
      <PracticeIntro
        availability={overview?.availability ?? { state: 'available' }}
        task={overview?.task ?? null}
        progress={
          overview?.progress ?? {
            attemptsCount: 0,
            bestScorePercent: null,
            passed: false,
            lastDurationSeconds: null,
          }
        }
        starting={starting}
        onStart={() => void handleStart()}
      />
    );
  }

  const currentGrade = current ? graded[current.id] : undefined;
  const answeredCurrent = current ? answers[current.id] !== undefined : false;

  return (
    <div className="space-y-4">
      <QuizProgressBar
        current={index}
        total={questions.length}
        answeredCount={Object.keys(answers).length}
      />

      <AnimatePresence mode="wait">
        {current && (
          <SlideLeft key={current.id} direction={directionRef.current}>
            <QuizQuestionCard
              question={current}
              index={index}
              total={questions.length}
              value={answers[current.id] ?? null}
              onChange={handleChange}
              onEnter={() => {
                if (isImmediate && !currentGrade) void handleGrade();
                else goNext();
              }}
              graded={
                currentGrade
                  ? {
                      isCorrect: currentGrade.isCorrect,
                      correctAnswer: currentGrade.correctAnswer,
                    }
                  : null
              }
            />
          </SlideLeft>
        )}
      </AnimatePresence>

      {/* Explanation renders only when the author wrote one — never invented. */}
      {isImmediate && feedback && (
        <QuizFeedbackPanel
          feedback={{
            isCorrect: feedback.isCorrect,
            explanation: feedback.explanation,
            currentStreak: feedback.currentStreak,
          }}
          burstKey={burstKey}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-ink-700 dark:text-slate-200 dark:hover:bg-ink-800"
        >
          <ChevronLeft size={16} aria-hidden />
          {copy.previous}
        </button>

        {isImmediate && !currentGrade ? (
          <button
            type="button"
            onClick={() => void handleGrade()}
            disabled={!answeredCurrent}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
          >
            {copy.check}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={submitting || (!isImmediate && !answeredCurrent)}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
          >
            {index < questions.length - 1 ? copy.next : copy.finish}
            <ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};

export default AdvancedPracticeStage;
