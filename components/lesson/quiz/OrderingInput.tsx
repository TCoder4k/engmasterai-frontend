import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { QuizQuestionOption } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import { SPRING } from '../../shared/motion';

interface OrderingInputProps {
  options: QuizQuestionOption[]; // already server-shuffled display order
  value: string[] | null; // orderedOptionIds — the student's current arrangement
  onChange: (orderedOptionIds: string[]) => void;
  // Sprint 06B.5 — set once the server has graded this question.
  disabled?: boolean;
  // The authored correct sequence, revealed after grading.
  correctOrder?: string[] | null;
}

// Reorder by MOVING a segment with Up/Down — never drag-only, so this is
// fully keyboard-operable. The as-displayed order counts as the student's
// answer from the moment the question is shown (there is no "unselected"
// state for an ordering question), and every reorder updates it.
const OrderingInput: React.FC<OrderingInputProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  correctOrder = null,
}) => {
  const { t } = useTranslation();
  const [order, setOrder] = useState<string[]>(
    value && value.length === options.length ? value : options.map((o) => o.id),
  );

  // Reset local order whenever a NEW question's options arrive (options
  // identity/content changes between questions); does not fight the
  // student's own edits within the same question because `options` is
  // stable for as long as this question is showing.
  useEffect(() => {
    const initial = value && value.length === options.length ? value : options.map((o) => o.id);
    setOrder(initial);
    if (!value) onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const byId = new Map(options.map((o) => [o.id, o.text]));

  const move = (index: number, direction: -1 | 1) => {
    if (disabled) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    onChange(next);
  };

  // Once graded, each row says whether IT is in the right place — more
  // useful than one verdict on the whole sequence, since a student who got
  // three of four positions right can see exactly which one moved.
  const rowClass = (id: string, index: number): string => {
    if (!correctOrder) {
      return 'border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-950';
    }
    return correctOrder[index] === id
      ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/10 dark:border-emerald-500/50'
      : 'border-rose-300 bg-rose-50/60 dark:bg-rose-500/10 dark:border-rose-500/50';
  };

  return (
    <div>
      {!disabled && (
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2">{t.quiz.orderingHint}</p>
      )}
      <ol className="space-y-2">
        {order.map((id, index) => (
          <motion.li
            key={id}
            // `layout` gives a correct FLIP animation for free: the row
            // travels to its new position instead of teleporting there.
            // This works because the key is the option id (stable across
            // reorders), which it already was.
            layout
            transition={SPRING}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-colors duration-150 ${rowClass(id, index)}`}
          >
            <GripVertical size={16} className="flex-shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <span className="flex-1 text-[15px] font-semibold text-slate-800 dark:text-slate-100">
              {byId.get(id)}
            </span>
            <div className={`flex flex-col gap-0.5 flex-shrink-0 ${disabled ? 'hidden' : ''}`}>
              <button
                type="button"
                aria-label={t.quiz.moveUp}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    move(index, -1);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(index, 1);
                  }
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <ChevronUp size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t.quiz.moveDown}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    move(index, -1);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(index, 1);
                  }
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
};

export default OrderingInput;
