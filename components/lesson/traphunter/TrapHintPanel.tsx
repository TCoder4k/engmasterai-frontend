import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Lightbulb, Scissors, SpellCheck2 } from 'lucide-react';
import { Trap, TrapHint } from '../../../services/trapHunterService';
import { QuizQuestionOption } from '../../../services/quizService';
import { useTranslation } from '../../../i18n/useTranslation';
import { DURATION, EASE } from '../../shared/motion';

interface TrapHintPanelProps {
  trap: Trap;
  onRequestHint: (level: number) => void;
  loading: boolean;
  error: string | null;
}

// Sprint 06C — progressive hints.
//
// Everything rendered here came from the server, and everything the server
// sent came from what a teacher authored: Level 1 is computed from the
// question's own correctAnswer/options, Level 2 IS the authored explanation.
// There is no generated text in this component and none may be added — no
// "AI is thinking", no streamed sentence, no substitute for an explanation
// nobody wrote.
//
// A question with no real hint source has hintsAvailable === 0 and this
// component renders NOTHING — not a disabled button, not an empty box.
//
// TAKING A HINT COSTS NOTHING. There is no "used a hint" badge, no reduced
// credit, no bar on completing the trap afterwards. Trap Hunter evaluates
// correction, not exam integrity.
const TrapHintPanel: React.FC<TrapHintPanelProps> = ({
  trap,
  onRequestHint,
  loading,
  error,
}) => {
  const { t } = useTranslation();

  if (trap.hintsAvailable === 0) return null;

  const optionText = (id: string): string =>
    trap.options?.find((option: QuizQuestionOption) => option.id === id)?.text ?? id;

  const nextLevel = trap.hintLevel + 1;
  const hasMore = nextLevel <= trap.hintsAvailable;

  // The nudge, not a gate. From 2 failed corrections the trigger gets more
  // visual weight so a stuck student notices it exists — it is never opened
  // automatically, never consumed on their behalf, and never required.
  const nudge = trap.attempts >= 2 && hasMore;

  const renderHint = (hint: TrapHint) => {
    switch (hint.payload.shape) {
      case 'eliminate':
        return (
          <div key={hint.level} className="flex items-start gap-2">
            <Scissors size={14} className="mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="font-bold">{t.trapHunter.hintEliminateTitle}: </span>
              {/* Plain text, deliberately: this is what a screen-reader user
                  gets instead of the strikethrough on the options above. */}
              {hint.payload.optionIds.map(optionText).join(', ')}
            </p>
          </div>
        );
      case 'firstOption':
        return (
          <div key={hint.level} className="flex items-start gap-2">
            <Scissors size={14} className="mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="font-bold">{t.trapHunter.hintFirstOptionTitle}: </span>
              {optionText(hint.payload.optionId)}
            </p>
          </div>
        );
      case 'letters':
        return (
          <div key={hint.level} className="flex items-start gap-2">
            <SpellCheck2 size={14} className="mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="font-bold">{t.trapHunter.hintLettersTitle}: </span>
              {t.trapHunter.hintLettersBody
                .replace('{{length}}', String(hint.payload.length))
                .replace('{{first}}', hint.payload.firstCharacter)}
            </p>
          </div>
        );
      case 'explanation':
        return (
          <div key={hint.level} className="flex items-start gap-2">
            <BookOpen size={14} className="mt-0.5 flex-shrink-0 text-blue-400" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="font-bold">{t.trapHunter.explanationLabel}: </span>
              {hint.payload.text}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-4">
      {trap.hints.length > 0 && (
        <motion.div
          // Polite, so an unlocked hint is announced without interrupting.
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE }}
          className="mb-3 space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          {trap.hints.map(renderHint)}
        </motion.div>
      )}

      {hasMore ? (
        <button
          type="button"
          onClick={() => onRequestHint(nextLevel)}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 disabled:pointer-events-none ${
            nudge
              ? 'border-2 border-amber-400 bg-amber-100 text-amber-800 shadow-md shadow-amber-500/20 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-200'
              : 'border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-400 dark:hover:border-amber-500/50'
          }`}
        >
          <Lightbulb size={13} aria-hidden="true" />
          {nudge
            ? t.trapHunter.hintAction
            : trap.hintLevel === 0
              ? t.trapHunter.hintActionFirst
              : t.trapHunter.hintNextAction}
        </button>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {t.trapHunter.hintExhausted}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default TrapHintPanel;
