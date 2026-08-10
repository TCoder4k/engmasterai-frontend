import React, { useState } from 'react';
import { PartyPopper, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import Modal from '../../shared/Modal';

interface GuessWordSessionSummaryProps {
  totalWords: number;
  learnedThisSessionCount: number;
  struggledCount: number;
  onReviewStruggled: () => void;
  onRestartFull: () => void;
  onExit: () => void;
}

// Dedicated summary for Guess-the-Word, not the generic SessionSummary —
// same reasoning as why the real SRS review flow has its own
// ReviewSessionSummary: this mode's completion carries real, mode-specific
// numbers (learned-this-session, struggled-this-session) the generic
// 2-button card has no shape for, plus a third, destructive action the
// generic card doesn't need to gate.
const GuessWordSessionSummary: React.FC<GuessWordSessionSummaryProps> = ({
  totalWords,
  learnedThisSessionCount,
  struggledCount,
  onReviewStruggled,
  onRestartFull,
  onExit,
}) => {
  const { t } = useTranslation();
  const [confirmingReset, setConfirmingReset] = useState(false);

  // A student can land here having done no work this run at all — the deck
  // was already fully learned from an earlier session. That is an honest,
  // distinct outcome, not a bug, so it gets its own copy rather than
  // reporting "0 words learned" as if something went wrong.
  const alreadyComplete = learnedThisSessionCount === 0;

  return (
    <div className="practice-fade-in bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-8 text-center space-y-6">
      <div>
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-400 dark:border-emerald-500 flex items-center justify-center practice-summary-glow">
          <PartyPopper size={28} className="text-emerald-500" aria-hidden="true" />
        </div>
        <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-4">
          {t.practice.guessDeckComplete}
        </p>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
          {alreadyComplete
            ? t.practice.guessAlreadyComplete
            : `${t.practice.guessLearnedThisSession}: ${learnedThisSessionCount}/${totalWords}`}
        </p>
      </div>

      {struggledCount > 0 && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          {t.practice.guessStruggledCount}: {struggledCount}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {struggledCount > 0 && (
          <button
            type="button"
            onClick={onReviewStruggled}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {t.practice.guessReviewStruggled}
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <RotateCcw size={15} aria-hidden="true" />
          {t.practice.guessRestartAll}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.practice.backToDecks}
        </button>
      </div>

      {/* Destructive — this deletes the deck's persisted Guess-mode
          progress, so it must never fire from a single click. */}
      {confirmingReset && (
        <Modal title={t.practice.guessRestartAllConfirmTitle} onClose={() => setConfirmingReset(false)}>
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t.practice.guessRestartAllConfirmBody}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingReset(false);
                  onRestartFull();
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white transition-colors"
              >
                {t.practice.guessRestartAllConfirmAction}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default GuessWordSessionSummary;
