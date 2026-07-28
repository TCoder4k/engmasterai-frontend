import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../../i18n/useTranslation';
import { DURATION } from '../../shared/motion';
import { useRipple } from './useRipple';

interface TrueFalseInputProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  // Sprint 06B.5 — set once the server has graded this question.
  disabled?: boolean;
  correctValue?: boolean | null;
}

// Same roving-tabindex radiogroup pattern as MultipleChoiceInput, sized
// down to its fixed two options.
const TrueFalseInput: React.FC<TrueFalseInputProps> = ({
  value,
  onChange,
  disabled = false,
  correctValue = null,
}) => {
  const { t } = useTranslation();
  const options = [
    { key: true, label: t.quiz.trueLabel, icon: <Check size={16} strokeWidth={3} aria-hidden="true" /> },
    { key: false, label: t.quiz.falseLabel, icon: <X size={16} strokeWidth={3} aria-hidden="true" /> },
  ];
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const [focusedIndex, setFocusedIndex] = useState(value === null ? 0 : selectedIndex);
  const { spawnRipple, rippleLayer } = useRipple();

  const revealed = correctValue !== null;

  const select = (index: number, event?: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setFocusedIndex(index);
    spawnRipple(event);
    onChange(options[index].key);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      const next = focusedIndex === 0 ? 1 : 0;
      select(next);
      (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
    }
  };

  const shellClass = (optionKey: boolean): string => {
    const isSelected = value === optionKey;
    if (revealed) {
      if (optionKey === correctValue) {
        return 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400 dark:text-emerald-300';
      }
      if (isSelected) {
        return 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/60 dark:text-rose-300';
      }
      return 'border-slate-200 text-slate-500 dark:border-ink-700 dark:text-slate-400 opacity-60';
    }
    return isSelected
      ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:border-violet-400 dark:text-violet-300 shadow-md shadow-violet-500/15'
      : 'border-slate-200 text-slate-600 hover:border-blue-300 dark:border-ink-700 dark:text-slate-300 dark:hover:border-blue-500/60';
  };

  return (
    <div role="radiogroup" aria-label="True or false" onKeyDown={handleKeyDown} className="grid grid-cols-2 gap-3">
      {options.map((option, index) => {
        const isSelected = value === option.key;
        return (
          <motion.button
            key={String(option.key)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={disabled}
            tabIndex={index === focusedIndex ? 0 : -1}
            onClick={(e) => select(index, e)}
            onFocus={() => setFocusedIndex(index)}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            transition={{ duration: DURATION.micro }}
            className={`relative overflow-hidden flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 font-black text-[15px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              disabled ? 'cursor-default' : ''
            } ${shellClass(option.key)}`}
          >
            {rippleLayer}
            <span className="relative flex items-center gap-2">
              {option.icon}
              {option.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default TrueFalseInput;
