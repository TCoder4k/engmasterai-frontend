import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Flame, XCircle } from 'lucide-react';
import { AnswerQuestionResponse } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import { DURATION, EASE, SPRING } from '../../shared/motion';
import CelebrationBurst from '../../shared/CelebrationBurst';

interface QuizFeedbackPanelProps {
  feedback: AnswerQuestionResponse;
  // Bumped by the parent on each new correct answer so the burst re-fires.
  burstKey: number;
}

// Sprint 06B.5 — the moment the student finds out.
//
// Everything here is server-decided: isCorrect, the explanation (authored,
// never generated), and the streak. This component renders that verdict; it
// never computes one.
//
// Accessibility: the whole panel is a polite live region announcing the
// verdict once. Every animated cue has a static equivalent — the coloured
// icon and the heading carry the meaning on their own, so under
// prefers-reduced-motion (handled globally by MotionConfig in App.tsx)
// nothing is lost.
const QuizFeedbackPanel: React.FC<QuizFeedbackPanelProps> = ({ feedback, burstKey }) => {
  const { t } = useTranslation();
  const { isCorrect, explanation, currentStreak } = feedback;

  return (
    <motion.div
      aria-live="polite"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className={`relative mt-4 rounded-2xl border-2 p-4 ${
        isCorrect
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : 'border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10'
      }`}
    >
      {isCorrect && <CelebrationBurst burstKey={burstKey} size="small" />}

      <div className="relative flex items-center gap-2.5">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING}
          className="flex-shrink-0"
        >
          {isCorrect ? (
            <CheckCircle2 size={22} className="text-emerald-500" aria-hidden="true" />
          ) : (
            <XCircle size={22} className="text-rose-500" aria-hidden="true" />
          )}
        </motion.span>

        <p
          className={`text-[15px] font-black ${
            isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {isCorrect ? t.quiz.feedbackCorrectTitle : t.quiz.feedbackIncorrectTitle}
        </p>

        {/*
          A real run of consecutive correct answers, counted by the server
          from its own record. Shown from 3 up — below that "1 in a row" is
          noise, not encouragement. This is a statistic, not a reward.
        */}
        {isCorrect && currentStreak >= 3 && (
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.12 }}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
          >
            <Flame size={12} aria-hidden="true" />
            {currentStreak} {t.quiz.streakLabel}
          </motion.span>
        )}
      </div>

      {/*
        Only ever rendered when an author wrote one. An absent explanation
        shows nothing at all — never a generated substitute, never an empty
        box. Revealed just after the verdict so the student reads the
        outcome first, then the reason.
      */}
      {explanation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE, delay: 0.18 }}
          className="relative mt-3 pt-3 border-t border-slate-200/70 dark:border-ink-700 flex items-start gap-2"
        >
          <BookOpen size={15} className="mt-0.5 flex-shrink-0 text-blue-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            <span className="font-bold">{t.quiz.explanationLabel}: </span>
            {explanation}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default QuizFeedbackPanel;
