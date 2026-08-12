import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { QuizQuestionOption } from '../../../services/quizService';
import { DURATION, SPRING } from '../../shared/motion';
import { useRipple } from './useRipple';

interface MultipleChoiceInputProps {
  options: QuizQuestionOption[];
  value: string | null; // selected optionId
  onChange: (optionId: string) => void;
  // Sprint 06B.5 — set once the server has graded this question. The input
  // becomes read-only and shows which option was right.
  disabled?: boolean;
  correctOptionId?: string | null;
  // Sprint 06C — options a Trap Hunter Level 1 hint has ruled out. They are
  // struck through but stay SELECTABLE: disabling them would rewrite this
  // component's roving-tabindex model (which indexes by position) and rail
  // the student down to one choice. A hint narrows the field; it does not
  // answer for them.
  //
  // This styling is reinforcement, never the carrier: TrapHintPanel lists
  // the ruled-out options as plain text, so a screen-reader user gets the
  // same hint without depending on a line-through.
  eliminatedOptionIds?: string[];
  // Onboarding placement redesign — opt-in, defaults to today's numbered/
  // violet look for every existing caller. Under 'placement': lettered
  // (A/B/C/D) badges instead of numbered ones, blue/indigo accent instead
  // of violet. All interaction logic below (roving tabindex, digit-key
  // shortcuts, ripple, ARIA radiogroup) is identical under either variant.
  variant?: 'default' | 'placement';
}

// role="radiogroup" with roving tabindex (WAI-ARIA radio pattern): Tab
// enters/leaves the group once, Up/Down/Left/Right move the roving focus
// AND the selection together, Space/Enter also select the focused option.
// Digit keys 1-9 select an option directly by position — the exam-software
// convention, discoverable via the number shown on each card.
const MultipleChoiceInput: React.FC<MultipleChoiceInputProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  correctOptionId = null,
  eliminatedOptionIds,
  variant = 'default',
}) => {
  const eliminated = new Set(eliminatedOptionIds ?? []);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex);
  const { spawnRipple, rippleLayer } = useRipple();

  const revealed = correctOptionId !== null;

  const select = (index: number, event?: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setFocusedIndex(index);
    spawnRipple(event);
    onChange(options[index].id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (focusedIndex + 1) % options.length;
      select(next);
      (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (focusedIndex - 1 + options.length) % options.length;
      select(prev);
      (e.currentTarget.children[prev] as HTMLElement | undefined)?.focus();
    } else if (/^[1-9]$/.test(e.key)) {
      const index = Number(e.key) - 1;
      if (index < options.length) {
        e.preventDefault();
        select(index);
        (e.currentTarget.children[index] as HTMLElement | undefined)?.focus();
      }
    }
  };

  // Three visual roles once graded, and only two before: correctness colours
  // (emerald/rose) never appear while the verdict is still unknown.
  const shellClass = (option: QuizQuestionOption): string => {
    const isSelected = value === option.id;
    if (revealed) {
      if (option.id === correctOptionId) {
        return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-400';
      }
      if (isSelected) {
        return 'border-rose-400 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/60';
      }
      return 'border-slate-200 dark:border-ink-700 opacity-60';
    }
    if (variant === 'placement') {
      return isSelected
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-400 shadow-md shadow-blue-500/15'
        : 'border-slate-200 hover:border-blue-300 dark:border-ink-700 dark:hover:border-blue-500/60';
    }
    return isSelected
      ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 dark:border-violet-400 shadow-md shadow-violet-500/15'
      : 'border-slate-200 hover:border-blue-300 dark:border-ink-700 dark:hover:border-blue-500/60';
  };

  const badgeClass = (option: QuizQuestionOption): string => {
    const isSelected = value === option.id;
    if (revealed) {
      if (option.id === correctOptionId)
        return 'bg-emerald-600 border-emerald-600 text-white';
      if (isSelected) return 'bg-rose-500 border-rose-500 text-white';
      return 'border-slate-300 text-slate-400 dark:border-ink-600 dark:text-slate-500';
    }
    if (variant === 'placement') {
      return isSelected
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'border-slate-300 text-slate-400 dark:border-ink-600 dark:text-slate-500';
    }
    return isSelected
      ? 'bg-violet-600 border-violet-600 text-white'
      : 'border-slate-300 text-slate-400 dark:border-ink-600 dark:text-slate-500';
  };

  // A/B/C/D under 'placement' (matches the mockup); 1/2/3/4 everywhere else
  // (unchanged, existing exam-style convention).
  const idleGlyph = (index: number) =>
    variant === 'placement' ? String.fromCharCode(65 + index) : index + 1;

  const badgeGlyph = (option: QuizQuestionOption, index: number) => {
    const isSelected = value === option.id;
    if (revealed) {
      if (option.id === correctOptionId) return <Check size={13} strokeWidth={3} />;
      if (isSelected) return <X size={13} strokeWidth={3} />;
      return idleGlyph(index);
    }
    return isSelected ? <Check size={13} strokeWidth={3} /> : idleGlyph(index);
  };

  return (
    <div role="radiogroup" aria-label="Answer options" onKeyDown={handleKeyDown} className="space-y-2.5">
      {options.map((option, index) => {
        const isSelected = value === option.id;
        return (
          <motion.button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={disabled}
            tabIndex={index === focusedIndex ? 0 : -1}
            onClick={(e) => select(index, e)}
            onFocus={() => setFocusedIndex(index)}
            // Press: a short scale-down on pointer-down that springs back.
            // 80ms (DURATION.micro) — long enough to read as a response,
            // short enough that it never feels like lag.
            whileTap={disabled ? undefined : { scale: 0.97 }}
            transition={{ duration: DURATION.micro }}
            className={`relative overflow-hidden w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              disabled ? 'cursor-default' : ''
            } ${shellClass(option)}`}
          >
            {rippleLayer}
            <motion.span
              aria-hidden="true"
              // Spring pop when the badge changes role (number → tick →
              // verdict), so the swap lands instead of hard-cutting.
              key={`${isSelected}-${revealed}`}
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={SPRING}
              className={`relative flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black border-2 ${badgeClass(option)}`}
            >
              {badgeGlyph(option, index)}
            </motion.span>
            <span
              className={`relative text-[15px] font-semibold text-slate-800 dark:text-slate-100 ${
                // Only before the verdict: once graded, the emerald/rose
                // roles above own the styling and a leftover strikethrough
                // would fight them.
                !revealed && eliminated.has(option.id) ? 'line-through opacity-45' : ''
              }`}
            >
              {option.text}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default MultipleChoiceInput;
