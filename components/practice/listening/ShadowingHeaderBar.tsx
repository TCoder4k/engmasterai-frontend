import React from 'react';
import { BarChart3, Flag, Star } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

// Sprint 11 Phase 4C — the status strip above the sentence.
//
// THE ACCURACY IS NULL UNTIL THE SERVER HAS SAID ONE. This component takes it
// as a nullable prop and renders nothing when it is null, rather than falling
// back to 0% or to a figure derived from the words on screen. A 0% next to a
// sentence nobody has attempted is not a neutral default — it reads as a score,
// and this panel is forbidden to produce one.
//
// The pill's COLOUR follows `passed`, never `accuracyPercent >= threshold`.
// Re-deriving the verdict here would create a second place for the rule to live
// and a second answer to disagree with; the same reason ShadowingResultPanel
// reads the flag.

interface ShadowingHeaderBarProps {
  /** 1-based, for display only. */
  segmentNumber: number;
  /** Words in the reference sentence — a count of what is on screen, not a score. */
  wordCount: number;
  /** From the server's verdict. Null before one exists. */
  accuracyPercent: number | null;
  /** The server's pass flag for that verdict. Null when there is no verdict. */
  passed: boolean | null;
  isSentenceSaved: boolean;
  onToggleSaveSentence: () => void;
}

const ShadowingHeaderBar: React.FC<ShadowingHeaderBarProps> = ({
  segmentNumber,
  wordCount,
  accuracyPercent,
  passed,
  isSentenceSaved,
  onToggleSaveSentence,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs font-bold rounded-lg">
          #{segmentNumber}
        </span>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
          {wordCount} {t.practice.listeningWordsUnit}
        </span>

        {accuracyPercent !== null && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${
              passed
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
            }`}
          >
            <BarChart3 size={13} aria-hidden="true" />
            <span>{t.practice.listeningAccuracyLabel}</span>
            {/* Its own element so the bare figure stays addressable — the label
                and the number are two facts, not one string. */}
            <span className="tabular-nums">{accuracyPercent}%</span>
          </span>
        )}
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
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500 text-amber-600 dark:text-amber-400'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
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
