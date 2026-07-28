import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronUp, RotateCcw, XCircle } from 'lucide-react';
import { StudentQuizQuestion, SubmitQuizResponse } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import { playComplete, playIncorrect } from '../../../services/feedbackSounds';
import {
  AnimatedCounter,
  DURATION,
  EASE,
  SPRING,
  StaggerContainer,
  StaggerItem,
} from '../../shared/motion';
import CelebrationBurst from '../../shared/CelebrationBurst';
import QuizReviewList from './QuizReviewList';

interface QuizSummaryProps {
  result: SubmitQuizResponse;
  questions: StudentQuizQuestion[];
  onContinue: () => void;
  onRetake: () => void;
}

const StatTile: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <StaggerItem className="bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-700 rounded-2xl p-3.5 text-center">
    <p className="text-lg font-black text-slate-900 dark:text-white">{value}</p>
    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
  </StaggerItem>
);

// Correct/incorrect/accuracy plus the three real stored numbers — attempts,
// best score, time taken. Every one comes straight off the server's
// response; durationSeconds being null (the attempt-duration cap) simply
// omits that tile rather than showing a fabricated 0.
const QuizSummary: React.FC<QuizSummaryProps> = ({ result, questions, onContinue, onRetake }) => {
  const { t } = useTranslation();
  const [showReview, setShowReview] = useState(false);
  const hasIncorrect = result.results.some((r) => !r.isCorrect);

  // Passing is the one genuinely celebratory moment in the quiz, so it gets
  // the burst + chime. Failing gets a short shake and stays amber — "not
  // yet", not an error.
  useEffect(() => {
    if (result.passed) playComplete();
    else playIncorrect();
    // Fires once per rendered result, never on an unrelated re-render.
  }, [result.passed]);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return minutes > 0
      ? `${minutes}${t.quiz.minutesShortUnit} ${rest}${t.quiz.secondsShortUnit}`
      : `${rest}${t.quiz.secondsShortUnit}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className="relative bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl p-6 shadow-sm dark:shadow-xl"
    >
      <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">{t.quiz.summaryTitle}</h2>

      <motion.div
        aria-live="polite"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={
          result.passed
            ? { scale: 1, opacity: 1 }
            : { scale: 1, opacity: 1, x: [0, -8, 8, -5, 5, 0] }
        }
        transition={result.passed ? SPRING : { duration: 0.3 }}
        className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-5 ${
          result.passed
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20'
            : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20'
        }`}
      >
        {result.passed && <CelebrationBurst burstKey={1} size="large" />}
        {result.passed ? (
          <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" aria-hidden="true" />
        ) : (
          <XCircle size={22} className="text-amber-500 flex-shrink-0" aria-hidden="true" />
        )}
        <p
          className={`relative text-[14px] font-bold ${
            result.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {result.passed ? t.quiz.passedBanner : t.quiz.failedBanner}
        </p>
      </motion.div>

      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <StatTile label={t.quiz.correctLabel} value={`${result.correctCount}/${result.totalCount}`} />
        <StatTile
          label={t.quiz.accuracyLabel}
          // Counts up to the server's real figure; the screen reader is
          // given only the final number, never the intermediate frames.
          value={<AnimatedCounter value={result.accuracyPercent} suffix="%" />}
        />
        <StatTile label={t.quiz.attemptsLabel} value={String(result.attemptsCount)} />
        <StatTile label={t.quiz.bestScoreLabel} value={`${result.bestScorePercent}%`} />
      </StaggerContainer>

      {result.durationSeconds !== null && (
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-3">
          {t.quiz.timeTakenLabel}: {formatDuration(result.durationSeconds)}
        </p>
      )}
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
        {t.quiz.passingScoreHint}: {result.passingScorePercent}%
      </p>

      {hasIncorrect && (
        <button
          type="button"
          onClick={() => setShowReview((v) => !v)}
          aria-expanded={showReview}
          className="mt-5 w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-700 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {showReview ? t.quiz.reviewToggleHide : t.quiz.reviewToggleShow}
          {showReview ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      )}

      {/* Height-animated disclosure rather than a hard mount/unmount. */}
      <AnimatePresence initial={false}>
        {showReview && (
          <motion.div
            key="review"
            // Height only — see GrammarBlockCard: an opacity-0 start would
            // make the content genuinely invisible if the animation never
            // runs (reduced motion, an interrupted frame, a test env).
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="overflow-hidden"
          >
            <QuizReviewList questions={questions} results={result.results} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        {!result.passed && (
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-200 dark:border-ink-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:border-blue-300 dark:hover:border-blue-500/60 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t.common.tryAgain}
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.quiz.continueAction}
        </button>
      </div>
    </motion.div>
  );
};

export default QuizSummary;
