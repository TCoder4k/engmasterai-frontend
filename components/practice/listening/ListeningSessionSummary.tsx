import React from 'react';
import { CheckCircle2, Layers, Target, Clock, Type } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatAudioTime } from '../useAudioPlayback';

interface ListeningSessionSummaryProps {
  title: string;
  level: string;
  categoryName: string;
  totalSegments: number;
  // Real, derived from assistedSegmentIds.size at completion — never
  // fabricated. A recording can only finish once every sentence is solved (the
  // workspace's Next stays disabled until solved), so assistedCount is always
  // <= totalSegments. Still needed even though Accuracy is word-based: it
  // drives "has mistakes to replay" and Replay Mistakes.
  assistedCount: number;
  // Real, this-attempt word counts (Sprint 03G) — wordsCorrect excludes
  // revealed words, so a recording where every sentence reached "solved" can
  // still show less than 100% here if some words needed help.
  wordsCorrect: number;
  wordsTotal: number;
  elapsedSeconds: number;
  onReplayMistakes: () => void;
  onReplayLesson: () => void;
  onBackToLessons: () => void;
}

// Listening's own completion card — deliberately not a reuse of
// components/practice/SessionSummary.tsx (Vocab's completion is score/percent
// + "Try again"/"Back to decks", a genuinely different shape).
//
// SPRINT 11 PHASE 2 — "Suggested next lessons" WAS REMOVED, and its absence is
// deliberate rather than overlooked. It ranked the client seed array by topic
// and by the in-memory session store, both of which are gone: the catalog now
// lives behind a paginated, permission-filtered API this component does not
// query. Rebuilding it would mean either a second request on every completion
// or a guess about what else the student may see — and a suggestion list that
// links to a recording the server would 404 is worse than no list. "Back to
// the catalog" is the honest route out until a real recommendation source
// exists.
//
// EVERY FIGURE BELOW IS SESSION-ONLY and says so. No Listening progress is
// persisted anywhere in Phase 2; the server-side progress model arrives in
// Phase 4A. Nothing here may imply otherwise.
const ListeningSessionSummary: React.FC<ListeningSessionSummaryProps> = ({
  title,
  level,
  categoryName,
  totalSegments,
  assistedCount,
  wordsCorrect,
  wordsTotal,
  elapsedSeconds,
  onReplayMistakes,
  onReplayLesson,
  onBackToLessons,
}) => {
  const { t } = useTranslation();
  // Word-based, not sentence-based: a sentence reaching "solved" doesn't mean
  // every word in it was typed correctly (some may have been revealed), so a
  // pass/fail-per-sentence accuracy would hide real mistakes.
  const accuracyPercent = wordsTotal > 0 ? Math.round((wordsCorrect / wordsTotal) * 100) : 0;
  const hasMistakes = assistedCount > 0;

  return (
    <div className="practice-fade-in bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-8 text-center space-y-6">
      <div>
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-400 dark:border-emerald-500 flex items-center justify-center practice-summary-glow">
          <CheckCircle2 size={30} className="text-emerald-500" aria-hidden="true" />
        </div>
        <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-4">
          {t.practice.listeningComplete}
        </p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">{title}</p>
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
          <span>{categoryName}</span>
          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md uppercase text-[10px] font-black">
            {level}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Layers size={16} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {totalSegments}/{totalSegments}
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningSegmentsStat}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Type size={16} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {wordsCorrect}/{wordsTotal}
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningWordsStat}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Target size={16} className="text-emerald-500" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {accuracyPercent}%
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningAccuracyLabel}
          </span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 flex flex-col items-center gap-1">
          <Clock size={16} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {formatAudioTime(elapsedSeconds)}
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningTimeStat}
          </span>
        </div>
      </div>

      {/* Session-only, stated outright. The catalog shows no progress for this
          recording after a refresh, and this line is why that is not a bug. */}
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {t.practice.listeningSessionOnlyNote}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {hasMistakes && (
          <button
            type="button"
            onClick={onReplayMistakes}
            className="px-5 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {t.practice.listeningReplayMistakes}
          </button>
        )}
        <button
          type="button"
          onClick={onReplayLesson}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.practice.listeningReplayLesson}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onBackToLessons}
          className="px-4 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.practice.listeningBackToLessons}
        </button>
      </div>
    </div>
  );
};

export default ListeningSessionSummary;
