import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { StudentQuizQuestion, SubmittedAnswer } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import MultipleChoiceInput from './MultipleChoiceInput';
import TrueFalseInput from './TrueFalseInput';
import FillBlankInput from './FillBlankInput';
import OrderingInput from './OrderingInput';

interface QuizQuestionCardProps {
  question: StudentQuizQuestion;
  index: number;
  total: number;
  value: SubmittedAnswer | null;
  onChange: (value: SubmittedAnswer) => void;
  onEnter: () => void;
  // Sprint 06B.5 — the server's verdict for this question, once it has one.
  // Null while the student is still deciding.
  graded?: { isCorrect: boolean; correctAnswer: unknown } | null;
}

// One question at a time. Dispatches to the per-type input purely on
// question.type — this component (and everything under it) never reads or
// cares which subject the lesson belongs to.
const QuizQuestionCard: React.FC<QuizQuestionCardProps> = ({
  question,
  index,
  total,
  value,
  onChange,
  onEnter,
  graded = null,
}) => {
  const { t } = useTranslation();
  const fillBlankId = `quiz-fill-blank-${question.id}`;
  const locked = graded !== null;
  const answer = graded?.correctAnswer as Record<string, unknown> | undefined;

  return (
    <motion.div
      // A wrong answer shakes the card once. Purely additive: the rose
      // border, the ✗ badge and the feedback panel all carry the same
      // meaning without it, so nothing is lost under reduced motion (where
      // MotionConfig suppresses this entirely).
      animate={
        locked && !graded.isCorrect ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }
      }
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl p-6 shadow-sm dark:shadow-xl"
    >
      {/* aria-live lives on this small counter, not the whole card, so a
          screen reader announces "Question 2 of 5" once per question
          instead of re-reading the full question text on every render. */}
      <div className="flex items-center justify-between mb-2">
        <p aria-live="polite" className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
          {t.quiz.questionLabel} {index + 1}/{total}
        </p>
        {locked && (
          <span
            title={t.quiz.lockedHint}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500"
          >
            <Lock size={11} aria-hidden="true" />
            {t.quiz.answeredProgress}
          </span>
        )}
      </div>

      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-1">{question.content}</h2>

      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt=""
          className="w-full max-h-64 object-contain rounded-2xl border border-slate-100 dark:border-ink-700 my-4"
        />
      )}
      {question.audioUrl && (
        <audio controls src={question.audioUrl} className="w-full my-4">
          Your browser does not support the audio element.
        </audio>
      )}

      <div className="mt-5">
        {question.type === 'MULTIPLE_CHOICE' && question.options && (
          <MultipleChoiceInput
            options={question.options}
            value={(value as { optionId: string } | null)?.optionId ?? null}
            onChange={(optionId) => onChange({ optionId })}
            disabled={locked}
            correctOptionId={locked ? ((answer?.optionId as string) ?? null) : null}
          />
        )}

        {question.type === 'TRUE_FALSE' && (
          <TrueFalseInput
            value={(value as { value: boolean } | null)?.value ?? null}
            onChange={(v) => onChange({ value: v })}
            disabled={locked}
            correctValue={locked ? ((answer?.value as boolean) ?? null) : null}
          />
        )}

        {question.type === 'FILL_BLANK' && (
          <FillBlankInput
            inputId={fillBlankId}
            value={(value as { text: string } | null)?.text ?? null}
            onChange={(text) => onChange({ text })}
            onEnter={onEnter}
            disabled={locked}
            isCorrect={graded ? graded.isCorrect : null}
          />
        )}

        {question.type === 'ORDERING' && question.options && (
          <OrderingInput
            options={question.options}
            value={(value as { orderedOptionIds: string[] } | null)?.orderedOptionIds ?? null}
            onChange={(orderedOptionIds) => onChange({ orderedOptionIds })}
            disabled={locked}
            correctOrder={locked ? ((answer?.orderedOptionIds as string[]) ?? null) : null}
          />
        )}
      </div>

      {/*
        FILL_BLANK is the one type whose correct answer can't be shown by
        highlighting an option, so it gets an explicit line — and only when
        the student actually got it wrong.
      */}
      {locked && !graded.isCorrect && question.type === 'FILL_BLANK' && (
        <p className="mt-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {t.quiz.correctAnswerLabel}: {((answer?.accepted as string[]) ?? []).join(' / ')}
        </p>
      )}
    </motion.div>
  );
};

export default QuizQuestionCard;
