import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, BookOpen, Type, Headphones } from 'lucide-react';
import { StudentQuizQuestion, SubmittedAnswer } from '../../services/quizService';
import {
  PlacementAttemptState,
  PlacementResult,
  StudentPlacementQuestion,
  answerPlacementQuestion,
  submitPlacementAttempt,
} from '../../services/placementService';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { readPlacementDraft, writePlacementDraft, clearPlacementDraft } from '../../services/placementDraft';
import { useTranslation } from '../../i18n/useTranslation';
import { SlideLeft } from '../shared/motion';
import QuizQuestionCard from '../lesson/quiz/QuizQuestionCard';
import PlacementProgressBar from './PlacementProgressBar';
import PlacementAudioPlayer from './PlacementAudioPlayer';

interface PlacementTestStepProps {
  attempt: PlacementAttemptState;
  onCompleted: (result: PlacementResult) => void;
  // Wizard-level "leave the test" — back to StartMethodStep. Distinct from
  // the in-test goPrev()/"Trước" button below (which moves between the 12
  // questions of THIS attempt); this exits the test screen entirely. Safe by
  // construction: the in-progress PlacementAttempt row is left untouched, so
  // choosing the placement method again from StartMethodStep resumes this
  // exact attempt (same questions, same answers so far, same expiresAt) via
  // POST /placement/start's existing idempotent-resume behavior — the same
  // guarantee that already makes a mid-test page refresh safe.
  onBack: () => void;
}

// Step 3 — the 12-question test itself. COMPOSED, NOT COPIED: the question
// card, the per-type inputs and the progress bar are the lesson quiz
// engine's, reused verbatim — see AdvancedPracticeStage.tsx for the same
// pattern applied to Advanced Practice. Placement never grades a question
// itself; `graded` is always null here (Invariant 9 — correctness is
// disclosed only once POST .../submit finalizes the whole attempt).
//
// toStudentQuizQuestion adapts PlacementQuestion's slightly smaller shape
// (no orderIndex, no per-question `answered` reveal state — Placement has
// neither) onto StudentQuizQuestion's, rather than widening the quiz
// engine's own type for one caller.
const toStudentQuizQuestion = (
  question: StudentPlacementQuestion,
  orderIndex: number,
): StudentQuizQuestion => ({
  id: question.id,
  type: question.type,
  difficulty: question.difficulty,
  content: question.content,
  options: question.options,
  audioUrl: question.audioUrl,
  transcript: question.transcript,
  imageUrl: question.imageUrl,
  orderIndex,
  answered: null,
});

const PlacementTestStep: React.FC<PlacementTestStepProps> = ({ attempt, onCompleted, onBack }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userId = authService.getUser()?.id;
  const questions = attempt.questions;

  const [answers, setAnswers] = useState<Record<string, SubmittedAnswer>>(() => {
    const map: Record<string, SubmittedAnswer> = {};
    attempt.answers.forEach((a) => {
      map[a.questionId] = a.submitted;
    });
    return map;
  });
  const [index, setIndex] = useState(() => {
    const draft = userId ? readPlacementDraft(userId) : null;
    const resumeIndex = draft?.currentIndex ?? 0;
    return Math.min(Math.max(resumeIndex, 0), Math.max(questions.length - 1, 0));
  });
  const [remainingMs, setRemainingMs] = useState(
    () => new Date(attempt.expiresAt).getTime() - Date.now(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const directionRef = useRef<1 | -1>(1);
  const autoSubmitFiredRef = useRef(false);
  // Read from inside the countdown's interval callback and the submit path
  // — both can fire from a stale closure, so the latest answers must come
  // from a ref rather than the `answers` state captured at effect-setup time.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Draft persistence — POSITION ONLY, never answers or the timer (see
  // placementDraft.ts's header note on why).
  useEffect(() => {
    if (!userId) return;
    writePlacementDraft(userId, { currentIndex: index });
  }, [userId, index]);

  const doSubmit = useCallback(async () => {
    if (autoSubmitFiredRef.current) return;
    autoSubmitFiredRef.current = true;
    setSubmitting(true);
    setError(null);

    const current = questions[index];
    const currentValue = current ? answersRef.current[current.id] : undefined;
    if (current && currentValue !== undefined) {
      // Best-effort — a late write failing here (e.g. the timer beat us to
      // the server) is expected and harmless: submit() grades from whatever
      // PlacementAnswer rows the server already has, regardless of this call.
      await answerPlacementQuestion(attempt.attemptId, current.id, currentValue).catch(() => {});
    }

    try {
      const result = await submitPlacementAttempt(attempt.attemptId);
      if (userId) clearPlacementDraft(userId);
      onCompleted(result);
    } catch (err) {
      autoSubmitFiredRef.current = false; // allow a retry
      setError(handleAuthError(err, navigate) || t.onboarding.testSubmitFailed);
      setSubmitting(false);
    }
  }, [attempt.attemptId, index, questions, userId, navigate, t, onCompleted]);

  // The countdown — recomputed from the SERVER's expiresAt on every tick,
  // never from a locally-decremented value. A closed-and-reopened tab (or a
  // clock that drifts) always shows the correct remaining time because
  // nothing here accumulates state; it is pure `expiresAt - Date.now()`.
  // The server independently enforces expiry regardless of whether this
  // client-side auto-submit ever fires — this is display + convenience only.
  useEffect(() => {
    const tick = () => {
      const ms = new Date(attempt.expiresAt).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0) void doSubmit();
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [attempt.expiresAt, doSubmit]);

  const current = questions[index];

  const handleChange = (value: SubmittedAnswer) => {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  };

  // Persisted on NAVIGATION, not on every keystroke — FILL_BLANK's input
  // fires onChange per character, and persisting per keystroke would burn
  // through the placementAnswer rate limit (120/600s) on one long answer.
  // An idempotent upsert server-side, so a redundant call here is harmless.
  const persistCurrent = async () => {
    if (!current) return;
    const value = answersRef.current[current.id];
    if (value === undefined) return;
    try {
      await answerPlacementQuestion(attempt.attemptId, current.id, value);
    } catch (err) {
      setError(handleAuthError(err, navigate) || t.onboarding.testAnswerFailed);
    }
  };

  const goNext = () => {
    void persistCurrent();
    if (index < questions.length - 1) {
      directionRef.current = 1;
      setIndex((i) => i + 1);
    } else {
      void doSubmit();
    }
  };

  // Same "persist on navigation, not on every keystroke" discipline as
  // goNext/goPrev — leaving the test screen counts as navigation, so
  // whatever's selected on the current question is saved before we go.
  const handleBack = () => {
    void persistCurrent();
    onBack();
  };

  const goPrev = () => {
    if (index === 0) return;
    void persistCurrent();
    directionRef.current = -1;
    setIndex((i) => i - 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || submitting) return;
    e.preventDefault();
    goNext();
  };

  if (submitting) {
    return (
      <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-xl p-10 text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
          {remainingMs <= 0 ? t.onboarding.testTimeUp : t.common.loading}
        </p>
      </div>
    );
  }

  if (!current) return null;

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = remainingMs < 60_000;

  const sectionCopy: Record<
    StudentPlacementQuestion['section'],
    { label: string; subtitle: string; icon: React.ComponentType<{ size?: number; className?: string }> }
  > = {
    GRAMMAR: {
      label: t.onboarding.testSectionGrammar,
      subtitle: t.onboarding.testSectionGrammarSubtitle,
      icon: BookOpen,
    },
    VOCABULARY: {
      label: t.onboarding.testSectionVocabulary,
      subtitle: t.onboarding.testSectionVocabularySubtitle,
      icon: Type,
    },
    LISTENING: {
      label: t.onboarding.testSectionListening,
      subtitle: t.onboarding.testSectionListeningSubtitle,
      icon: Headphones,
    },
  };
  const section = sectionCopy[current.section];
  const SectionIcon = section.icon;

  return (
    <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-xl p-6 sm:p-8" onKeyDown={handleKeyDown}>
      {/* submitting always renders the spinner branch above instead of this
          one, so there is no in-flight-submit race for this button to guard
          against. */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-3"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t.common.back}
      </button>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center"
            aria-hidden="true"
          >
            <SectionIcon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 truncate">
              {section.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{section.subtitle}</p>
          </div>
        </div>

        <div
          role="timer"
          aria-live="polite"
          className="flex-shrink-0 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-ink-700 px-3 py-1.5"
        >
          <Clock
            size={16}
            className={urgent ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}
            aria-hidden="true"
          />
          <div className="text-right leading-tight">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {t.onboarding.testTimeRemaining}
            </p>
            <p
              className={`text-base font-black tabular-nums ${
                urgent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'
              }`}
            >
              {minutes}:{String(seconds).padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      <PlacementProgressBar current={index} total={questions.length} />

      <AnimatePresence mode="wait">
        <SlideLeft key={current.id} direction={directionRef.current}>
          <QuizQuestionCard
            question={toStudentQuizQuestion(current, index)}
            index={index}
            total={questions.length}
            value={answers[current.id] ?? null}
            onChange={handleChange}
            onEnter={goNext}
            graded={null}
            variant="placement"
            renderAudio={({ audioUrl, transcript }) => (
              <PlacementAudioPlayer audioUrl={audioUrl} transcript={transcript} />
            )}
          />
        </SlideLeft>
      </AnimatePresence>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between mt-5">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-ink-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-ink-800 disabled:opacity-40"
        >
          <ChevronLeft size={16} aria-hidden />
          {t.common.previous}
        </button>

        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
        >
          {index < questions.length - 1 ? t.common.next : t.onboarding.testSubmit}
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default PlacementTestStep;
