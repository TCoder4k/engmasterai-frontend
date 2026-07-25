import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import type { RatingCounts } from './useReviewSession';

interface ReviewSessionSummaryProps {
  reviewedCount: number;
  retrainedCount: number;
  ratingCounts: RatingCounts;
  newlyLearnedCount: number;
  masteredCount: number;
  elapsedMs: number;
  backHref: string;
  onRestart: () => void;
}

const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// Real counts only (sprint plan §15). Every number here comes from what was
// actually submitted or actually transitioned this session — no XP, no
// streak, no fake daily target. Reuses the glow/fade-in convention Sprint
// 03G's ListeningSessionSummary established, not a new visual language.
//
// `retrainedCount` is reported separately from `reviewedCount` rather than
// folded into it: a retrain pass submits no review and changes no schedule,
// so counting it as a review would overstate the session.
const ReviewSessionSummary: React.FC<ReviewSessionSummaryProps> = ({
  reviewedCount,
  retrainedCount,
  ratingCounts,
  newlyLearnedCount,
  masteredCount,
  elapsedMs,
  backHref,
  onRestart,
}) => {
  const { t } = useTranslation();
  const correctCount = reviewedCount - ratingCounts.AGAIN;
  const accuracyPercent = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0;

  const breakdown: { label: string; value: number }[] = [
    { label: t.practice.again, value: ratingCounts.AGAIN },
    { label: t.practice.hard, value: ratingCounts.HARD },
    { label: t.practice.good, value: ratingCounts.GOOD },
    { label: t.practice.easy, value: ratingCounts.EASY },
  ];

  return (
    <div className="practice-fade-in bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-8 text-center space-y-6">
      <div>
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-400 dark:border-emerald-500 flex items-center justify-center practice-summary-glow">
          <CheckCircle2 size={30} className="text-emerald-500" aria-hidden="true" />
        </div>
        <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-4">{t.practice.reviewSessionComplete}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4">
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{reviewedCount}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.reviewedUnit}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4">
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{accuracyPercent}%</p>
          <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.listeningAccuracyLabel}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4">
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{formatElapsed(elapsedMs)}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
            {t.practice.elapsedLabel}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {t.practice.ratingBreakdownLabel}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {breakdown.map(({ label, value }) => (
            <div
              key={label}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2"
            >
              <p className="text-base font-black text-slate-900 dark:text-slate-100">{value}</p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Only shown when they actually happened — a zeroed row of
          achievements would read as a fabricated scoreboard. */}
      {(newlyLearnedCount > 0 || masteredCount > 0 || retrainedCount > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {newlyLearnedCount > 0 && (
            <span>
              {t.practice.newlyLearnedLabel}: {newlyLearnedCount}
            </span>
          )}
          {masteredCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {t.practice.newlyMasteredLabel}: {masteredCount}
            </span>
          )}
          {retrainedCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {t.practice.retrainedLabel}: {retrainedCount}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {t.practice.reviewAgainAction}
        </button>
        <Link
          to={backHref}
          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {t.practice.backToDecks}
        </Link>
      </div>
    </div>
  );
};

export default ReviewSessionSummary;
