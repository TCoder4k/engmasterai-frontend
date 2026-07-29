import React from 'react';
import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import { Trap, TrapHint } from '../../../services/trapHunterService';
import { AnswerTrapResponse } from '../../../services/trapHunterService';
import { SubmittedAnswer } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import MultipleChoiceInput from '../quiz/MultipleChoiceInput';
import TrueFalseInput from '../quiz/TrueFalseInput';
import FillBlankInput from '../quiz/FillBlankInput';
import OrderingInput from '../quiz/OrderingInput';

interface TrapCardProps {
  trap: Trap;
  index: number;
  total: number;
  value: SubmittedAnswer | null;
  onChange: (value: SubmittedAnswer) => void;
  onEnter: () => void;
  // The server's verdict for the correction just submitted, or null while
  // the student is still deciding.
  graded: AnswerTrapResponse | null;
}

// Sprint 06C — one trap at a time.
//
// The four per-type inputs are IMPORTED from ../quiz/, not reimplemented. A
// trap is one of the student's own quiz questions, so a second set of inputs
// would be a second set of answer shapes to keep in sync — exactly the
// duplicated-logic this sprint forbids. Dispatch is purely on question type;
// nothing here reads or cares which subject the lesson belongs to.
const TrapCard: React.FC<TrapCardProps> = ({
  trap,
  index,
  total,
  value,
  onChange,
  onEnter,
  graded,
}) => {
  const { t } = useTranslation();
  const fillBlankId = `trap-fill-blank-${trap.questionId}`;
  const locked = graded !== null && graded.isCorrect;
  const answer = graded?.correctAnswer as Record<string, unknown> | undefined;

  // Level 1 hint for a multiple-choice trap, if it has been unlocked.
  const eliminatedOptionIds = trap.hints
    .filter((hint: TrapHint) => hint.payload.shape === 'eliminate')
    .flatMap((hint) =>
      hint.payload.shape === 'eliminate' ? hint.payload.optionIds : [],
    );

  const difficultyLabel = (): string | null => {
    switch (trap.difficulty) {
      case 'EASY':
        return t.trapHunter.difficultyEasy;
      case 'MEDIUM':
        return t.trapHunter.difficultyMedium;
      case 'HARD':
        return t.trapHunter.difficultyHard;
      default:
        // No authored difficulty means no badge. Nothing is invented to
        // fill the space.
        return null;
    }
  };

  // What the student put down in the quiz. Rendered read-only, purely as
  // context for what is being corrected — never re-graded here.
  const wrongAnswerText = (): string | null => {
    const wrong = trap.wrongAnswer as Record<string, unknown> | null;
    if (!wrong) return null;
    const textOf = (id: string) =>
      trap.options?.find((option) => option.id === id)?.text ?? id;

    if (typeof wrong.optionId === 'string') return textOf(wrong.optionId);
    if (typeof wrong.value === 'boolean')
      return wrong.value ? t.quiz.trueLabel : t.quiz.falseLabel;
    if (typeof wrong.text === 'string') return wrong.text;
    if (Array.isArray(wrong.orderedOptionIds))
      return (wrong.orderedOptionIds as string[]).map(textOf).join(' → ');
    return null;
  };

  const previousAnswer = wrongAnswerText();
  const difficulty = difficultyLabel();

  return (
    <motion.div
      // A missed correction shakes the card once. Additive only: the rose
      // panel and its heading carry the same meaning, so nothing is lost
      // under reduced motion (suppressed globally by MotionConfig).
      animate={
        graded && !graded.isCorrect ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }
      }
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl p-6 shadow-sm dark:shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p
          aria-live="polite"
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400"
        >
          <Crosshair size={12} aria-hidden="true" />
          {t.trapHunter.trapLabel} {index + 1}/{total}
        </p>
        {difficulty && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-ink-950 dark:text-slate-400">
            {t.trapHunter.difficultyLabel}: {difficulty}
          </span>
        )}
      </div>

      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-1">
        {trap.content}
      </h2>

      {previousAnswer && (
        <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
          {t.trapHunter.yourAnswerLabel}:{' '}
          <span className="line-through text-rose-500/80 dark:text-rose-400/80">
            {previousAnswer}
          </span>
        </p>
      )}

      {trap.imageUrl && (
        <img
          src={trap.imageUrl}
          alt=""
          className="w-full max-h-64 object-contain rounded-2xl border border-slate-100 dark:border-ink-700 my-4"
        />
      )}
      {trap.audioUrl && (
        <audio controls src={trap.audioUrl} className="w-full my-4">
          Your browser does not support the audio element.
        </audio>
      )}

      <div className="mt-5">
        {trap.type === 'MULTIPLE_CHOICE' && trap.options && (
          <MultipleChoiceInput
            options={trap.options}
            value={(value as { optionId: string } | null)?.optionId ?? null}
            onChange={(optionId) => onChange({ optionId })}
            disabled={locked}
            correctOptionId={locked ? ((answer?.optionId as string) ?? null) : null}
            eliminatedOptionIds={eliminatedOptionIds}
          />
        )}

        {trap.type === 'TRUE_FALSE' && (
          <TrueFalseInput
            value={(value as { value: boolean } | null)?.value ?? null}
            onChange={(v) => onChange({ value: v })}
            disabled={locked}
            correctValue={locked ? ((answer?.value as boolean) ?? null) : null}
          />
        )}

        {trap.type === 'FILL_BLANK' && (
          <FillBlankInput
            inputId={fillBlankId}
            value={(value as { text: string } | null)?.text ?? null}
            onChange={(text) => onChange({ text })}
            onEnter={onEnter}
            disabled={locked}
            isCorrect={graded ? graded.isCorrect : null}
          />
        )}

        {trap.type === 'ORDERING' && trap.options && (
          <OrderingInput
            options={trap.options}
            value={(value as { orderedOptionIds: string[] } | null)?.orderedOptionIds ?? null}
            onChange={(orderedOptionIds) => onChange({ orderedOptionIds })}
            disabled={locked}
            correctOrder={locked ? ((answer?.orderedOptionIds as string[]) ?? null) : null}
          />
        )}
      </div>

      {/* FILL_BLANK's correct answer can't be shown by highlighting an
          option, so it gets an explicit line once the trap is cleared. */}
      {locked && trap.type === 'FILL_BLANK' && (
        <p className="mt-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {t.quiz.correctAnswerLabel}: {((answer?.accepted as string[]) ?? []).join(' / ')}
        </p>
      )}
    </motion.div>
  );
};

export default TrapCard;
