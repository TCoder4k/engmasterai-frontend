import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

interface SessionHeaderProps {
  deckName: string;
  libraryName: string;
  wordCount: number;
  onExit: () => void;
}

// Deck context header for a vocabulary practice session. Shows the deck's
// total word count only — a live per-card progress indicator would need
// state lifted from each session mode (flashcard/dictation/games each track
// their own index independently); deferred to the Sprint 03D polish pass
// rather than shipping a progress bar that doesn't actually move. SRS
// filter chips and a real mastery summary belong here once Sprint 04 (SRS
// backend) ships — absent for now rather than a grayed-out fake.
const SessionHeader: React.FC<SessionHeaderProps> = ({ deckName, libraryName, wordCount, onExit }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onExit}
          aria-label={t.practice.backToDecks}
          className="shrink-0 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">{deckName}</p>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 truncate">{libraryName}</p>
        </div>
      </div>

      <span className="shrink-0 text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
        {wordCount} {t.vocab.wordsUnit}
      </span>
    </div>
  );
};

export default SessionHeader;
