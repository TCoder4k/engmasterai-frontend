import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

interface FillBlankInputProps {
  value: string | null;
  onChange: (text: string) => void;
  onEnter: () => void;
  inputId: string;
  // Sprint 06B.5 — set once the server has graded this question.
  disabled?: boolean;
  isCorrect?: boolean | null;
}

// A single free-text field. Enter here still advances/submits (handled by
// the caller via onEnter) — only the digit-key MULTIPLE_CHOICE shortcut is
// suppressed while this input has focus, so a fill-blank answer can freely
// contain digits (e.g. "in 1990").
const FillBlankInput: React.FC<FillBlankInputProps> = ({
  value,
  onChange,
  onEnter,
  inputId,
  disabled = false,
  isCorrect = null,
}) => {
  const { t } = useTranslation();

  // Three states, in priority order: graded (emerald/rose), typed-in but
  // not yet graded (a settled violet ring, matching the option inputs'
  // "you chose this" language), or untouched.
  const stateClass =
    isCorrect === true
      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10 dark:border-emerald-400'
      : isCorrect === false
        ? 'border-rose-400 bg-rose-50/60 dark:bg-rose-500/10 dark:border-rose-500/60'
        : value
          ? 'border-violet-400 dark:border-violet-500/60 bg-white dark:bg-ink-950'
          : 'border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-950';

  return (
    <input
      id={inputId}
      type="text"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          // Claims Enter fully while this field has focus, so the parent
          // question card's own Enter-to-advance handler (bound higher up
          // the tree) never double-fires for the same keypress.
          e.stopPropagation();
          onEnter();
        }
      }}
      placeholder={t.quiz.fillBlankPlaceholder}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      className={`w-full px-4 py-3.5 rounded-2xl border-2 text-[15px] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-default ${stateClass}`}
    />
  );
};

export default FillBlankInput;
