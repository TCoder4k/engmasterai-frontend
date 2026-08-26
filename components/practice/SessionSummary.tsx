import React from 'react';
import { PartyPopper, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { SessionResult } from './types';

interface SessionSummaryProps {
  result: SessionResult;
  onRestart: () => void;
  onExit: () => void;
  // Optional — the caller only passes these when there's a next practice
  // mode to jump to (VocabPracticeSessionPage omits them past the last tab),
  // so this generic summary stays agnostic of the mode list itself.
  onNext?: () => void;
  nextModeLabel?: string;
}

// End-of-session card — this component itself is client-side-only and
// discarded on navigation away. Note: as of Sprint 04, Flashcard's
// Again/Hard/Good/Easy ratings ARE persisted server-side (real SRS
// progress) even though this summary card is not; only Dictation's
// suggested-rating flow and Games' score remain purely session-local.
const SessionSummary: React.FC<SessionSummaryProps> = ({ result, onRestart, onExit, onNext, nextModeLabel }) => {
  const { t } = useTranslation();
  const percent = result.totalCards > 0 ? Math.round((result.correctCount / result.totalCards) * 100) : 0;

  return (
    <div className="practice-fade-in bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-8 text-center space-y-5">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center">
        <PartyPopper size={26} aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-black text-slate-900 dark:text-slate-100">{t.practice.sessionComplete}</p>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
          {t.practice.scoreLabel}: {result.correctCount}/{result.totalCards} ({percent}%)
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.common.tryAgain}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.practice.backToDecks}
        </button>
        {onNext && nextModeLabel && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {t.practice.nextModeAction(nextModeLabel)}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SessionSummary;
