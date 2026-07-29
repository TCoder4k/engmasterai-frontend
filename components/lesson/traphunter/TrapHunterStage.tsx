import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronRight, Crosshair, Target } from 'lucide-react';
import {
  answerTrap,
  getTrapHunter,
  requestTrapHint,
  AnswerTrapResponse,
  Trap,
  TrapHunterProgress,
} from '../../../services/trapHunterService';
import { SubmittedAnswer } from '../../../services/quizService';
import { handleAuthError } from '../../../services/apiError';
import { playSelect, playCorrect, playIncorrect } from '../../../services/feedbackSounds';
import { useTranslation } from '../../../i18n/useTranslation';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { SlideLeft } from '../../shared/motion';
import QuizFeedbackPanel from '../quiz/QuizFeedbackPanel';
import TrapCard from './TrapCard';
import TrapHintPanel from './TrapHintPanel';
import TrapHunterSummary from './TrapHunterSummary';

interface TrapHunterStageProps {
  lessonId: string;
  // Lets LessonPage keep the stage stepper's 'traphunter' tile — and the
  // lesson's own completion — in sync, without this component knowing the
  // stepper exists.
  onProgressChange?: (progress: TrapHunterProgress) => void;
  onGoToQuiz?: () => void;
}

type Phase = 'loading' | 'error' | 'hunting' | 'done';

// Sprint 06C — the correction round.
//
// Deliberately knows nothing about Grammar, or any subject: everything it
// touches (Trap, the per-type inputs, grading) is generic, and only the
// lesson content fetched by lessonId decides the subject. Pinned by
// trapHunterIsGeneric.test.ts.
//
// THE QUEUE. Traps are worked one at a time. A correct answer removes the
// trap; a MISSED one moves to the BACK of the queue and comes round again,
// so the second encounter is recall rather than copying an explanation that
// is still on screen. Completion requires every trap answered correctly —
// there is no way to skip one, and equally no way to be locked out of one.
//
// Queue order lives here and nowhere else: no draft, no sessionStorage. A
// refresh rebuilds it from the server's uncleared set, so cleared state is
// always exact and only the shuffle order is lost — which costs nothing.
const TrapHunterStage: React.FC<TrapHunterStageProps> = ({
  lessonId,
  onProgressChange,
  onGoToQuiz,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [traps, setTraps] = useState<Trap[]>([]);
  const [progress, setProgress] = useState<TrapHunterProgress | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, SubmittedAnswer>>({});
  const [graded, setGraded] = useState<AnswerTrapResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  // Always forward here: the queue moves in one direction and there is no
  // Previous. Kept so SlideLeft reads the same as it does in QuizStage.
  const directionRef = useRef<1 | -1>(1);

  const load = useCallback(() => {
    setPhase('loading');
    setLoadError(null);
    getTrapHunter(lessonId)
      .then((res) => {
        setTraps(res.traps);
        setProgress(res.progress);
        onProgressChange?.(res.progress);
        // Uncleared only, in the quiz's own question order. Cleared traps
        // stay in `traps` so the summary can count them, but never re-enter
        // the queue.
        setQueue(res.traps.filter((trap) => !trap.cleared).map((trap) => trap.questionId));
        setGraded(null);
        setAnswers({});
        setPhase('hunting');
      })
      .catch((err) => {
        setLoadError(handleAuthError(err, navigate) || t.trapHunter.loadFailed);
        setPhase('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  if (phase === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (phase === 'error' || !progress) {
    return <ErrorState message={loadError ?? t.trapHunter.loadFailed} onRetry={load} />;
  }

  // The three states with no trap on screen, each said differently on
  // purpose — see TrapHunterSummary.
  if (!progress.hasSource) {
    return <TrapHunterSummary kind="blocked" total={0} onGoToQuiz={onGoToQuiz} />;
  }
  if (progress.total === 0) {
    return <TrapHunterSummary kind="no-traps" total={0} />;
  }
  if (queue.length === 0) {
    return <TrapHunterSummary kind="all-cleared" total={progress.total} />;
  }

  const currentId = queue[0];
  const current = traps.find((trap) => trap.questionId === currentId);
  if (!current) return <ErrorState message={t.trapHunter.loadFailed} onRetry={load} />;

  const currentValue = answers[currentId] ?? null;
  const clearedCount = traps.filter((trap) => trap.cleared).length;

  const handleAnswerChange = (value: SubmittedAnswer) => {
    // A verdict is showing — the student is reading, not answering.
    if (graded) return;
    // Acknowledges the CHOICE, never its correctness, which the client
    // genuinely does not know. Deliberately not playCorrect.
    playSelect();
    setAnswers((prev) => ({ ...prev, [currentId]: value }));
  };

  const handleCheck = () => {
    if (!currentValue || graded || checking) return;
    setChecking(true);
    setCheckError(null);
    answerTrap(lessonId, { questionId: currentId, submitted: currentValue })
      .then((result) => {
        setGraded(result);
        // The server's counts are authoritative — nothing here recomputes
        // whether the stage is finished.
        setTraps((prev) =>
          prev.map((trap) =>
            trap.questionId === currentId
              ? {
                  ...trap,
                  attempts: result.attempts,
                  cleared: result.isCorrect
                    ? {
                        clearedAt: new Date().toISOString(),
                        correctAnswer: result.correctAnswer,
                        explanation: result.explanation,
                      }
                    : trap.cleared,
                }
              : trap,
          ),
        );
        const nextProgress: TrapHunterProgress = {
          ...progress,
          cleared: result.clearedCount,
          completed: result.allCleared,
        };
        setProgress(nextProgress);
        onProgressChange?.(nextProgress);

        if (result.isCorrect) {
          playCorrect();
          setBurstKey((key) => key + 1);
        } else {
          // Exactly the same call on the first miss and the fifth. The
          // feedback must not escalate as a student struggles.
          playIncorrect();
        }
      })
      .catch((err) => {
        setCheckError(handleAuthError(err, navigate) || t.trapHunter.checkFailed);
      })
      .finally(() => setChecking(false));
  };

  const handleNext = () => {
    if (!graded) return handleCheck();
    directionRef.current = 1;

    if (graded.isCorrect) {
      setQueue((prev) => prev.slice(1));
    } else {
      // Back of the queue, and the attempt is wiped so the student answers
      // it again rather than resubmitting what is already on screen.
      setQueue((prev) => [...prev.slice(1), prev[0]]);
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[currentId];
        return next;
      });
    }
    setGraded(null);
    setHintError(null);
  };

  const handleRequestHint = (level: number) => {
    if (hintLoading) return;
    setHintLoading(true);
    setHintError(null);
    requestTrapHint(lessonId, { questionId: currentId, level })
      .then((result) => {
        setTraps((prev) =>
          prev.map((trap) =>
            trap.questionId === result.questionId
              ? { ...trap, hints: result.hints, hintLevel: result.hintLevel }
              : trap,
          ),
        );
      })
      .catch((err) => {
        setHintError(handleAuthError(err, navigate) || t.trapHunter.hintFailed);
      })
      .finally(() => setHintLoading(false));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || checking) return;
    if (!graded && !currentValue) return;
    e.preventDefault();
    handleNext();
  };

  const primaryLabel = (): string => {
    if (checking) return t.trapHunter.checkingAction;
    if (!graded) return t.trapHunter.checkAction;
    // The last trap only finishes the round if it was actually cleared; a
    // miss re-queues it, so there is still a next trap.
    if (graded.isCorrect && queue.length === 1) return t.trapHunter.finishAction;
    return t.trapHunter.nextTrapAction;
  };

  const clearedPercent =
    progress.total > 0 ? Math.round((clearedCount / progress.total) * 100) : 0;

  return (
    <div onKeyDown={handleKeyDown}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900 dark:shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white">
            <Target size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {t.trapHunter.title}
            </h2>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {t.trapHunter.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-right dark:bg-ink-950">
            <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t.trapHunter.remainingLabel}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              {queue.length}
            </span>
          </span>
          <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-right dark:bg-ink-950">
            <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t.trapHunter.clearedLabel}
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {clearedCount}/{progress.total}
            </span>
          </span>
        </div>
      </header>

      {/* Real counts, never a position guess: the bar reflects traps
          actually corrected, which is the only thing that moves this stage
          toward completion. */}
      <div
        role="progressbar"
        aria-label={t.trapHunter.progressLabel}
        aria-valuenow={clearedCount}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800"
      >
        <div
          style={{ width: `${clearedPercent}%` }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {/*
          Keyed on the trap id AND the queue length, so a re-queued trap
          coming back around re-enters rather than silently swapping its
          contents under the student — the same reason QuizQuestionCard
          gained a key in Sprint 06B.5.
        */}
        <SlideLeft key={`${currentId}-${queue.length}`} direction={directionRef.current}>
          <TrapCard
            trap={current}
            index={clearedCount}
            total={progress.total}
            value={currentValue}
            onChange={handleAnswerChange}
            onEnter={handleNext}
            graded={graded}
          />

          {graded && (
            <QuizFeedbackPanel
              feedback={graded}
              burstKey={burstKey}
              correctTitle={t.trapHunter.clearedTitle}
              incorrectTitle={t.trapHunter.missedTitle}
              streakLabel={t.trapHunter.streakLabel}
              footnote={t.trapHunter.requeuedHint}
            />
          )}

          {/* Hints stay available while a miss is on screen — that is
              exactly when a stuck student needs one. They disappear once
              the trap is cleared, when there is nothing left to hint at. */}
          {!graded?.isCorrect && (
            <TrapHintPanel
              trap={current}
              onRequestHint={handleRequestHint}
              loading={hintLoading}
              error={hintError}
            />
          )}
        </SlideLeft>
      </AnimatePresence>

      {checkError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">
          {checkError}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <Crosshair size={12} aria-hidden="true" />
          {queue.length} {t.trapHunter.remainingLabel}
        </span>

        <button
          type="button"
          onClick={handleNext}
          disabled={checking || (!graded && !currentValue)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {primaryLabel()}
          {graded && <ChevronRight size={16} aria-hidden="true" />}
        </button>
      </div>

      <p className="mt-4 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
        {t.trapHunter.keyboardHint}
      </p>
    </div>
  );
};

export default TrapHunterStage;
