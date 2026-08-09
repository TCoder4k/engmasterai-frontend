import React from 'react';
import { Flag, Star } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

// Sprint 11 Phase 4C — the status strip above the sentence.
//
// NO ACCURACY HERE. It used to render as a pill in this row; Phase 4C's dark
// redesign moved it into `ShadowingScoreRing`, next to the word-by-word
// comparison in `ShadowingResultPanel`, and it is NOT ALSO repeated here — one
// number in two places is one number that can be read as two, the same rule
// `ShadowingResultPanel` already states for the row above its own transcript.

interface ShadowingHeaderBarProps {
  /** 1-based, for display only. */
  segmentNumber: number;
  /** Words in the reference sentence — a count of what is on screen, not a score. */
  wordCount: number;
  isSentenceSaved: boolean;
  onToggleSaveSentence: () => void;
}

const ShadowingHeaderBar: React.FC<ShadowingHeaderBarProps> = ({
  segmentNumber,
  wordCount,
  isSentenceSaved,
  onToggleSaveSentence,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-1 bg-slate-50 dark:bg-[#0B132B] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs font-bold rounded-lg">
          #{segmentNumber}
        </span>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-500">
          {wordCount} {t.practice.listeningWordsUnit}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* SESSION-ONLY, and the tooltip says so. Shadowing has no saved-sentence
            endpoint any more than Dictation does; promising a bookmark that
            evaporates on refresh without saying so is the lie this avoids. */}
        <button
          type="button"
          onClick={onToggleSaveSentence}
          aria-pressed={isSentenceSaved}
          title={t.practice.sessionOnlySaveNote}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isSentenceSaved
              ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
              : 'bg-slate-50 dark:bg-[#0B132B] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Star
            size={14}
            className={isSentenceSaved ? 'fill-amber-400 text-amber-400' : ''}
            aria-hidden="true"
          />
          <span>{isSentenceSaved ? t.practice.savedSentence : t.practice.saveSentence}</span>
        </button>

        {/* DISABLED, exactly as in Dictation, because no report endpoint exists.
            A live-looking button that drops a student's report on the floor is
            worse than a grey one that admits the feature is not here yet. */}
        <button
          type="button"
          disabled
          title={t.common.comingSoon}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B132B] text-slate-400 dark:text-slate-600 text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
        >
          <Flag size={14} aria-hidden="true" />
          <span>
            {t.practice.reportIssue}{' '}
            <span className="uppercase text-[9px]">({t.common.soon})</span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default ShadowingHeaderBar;
