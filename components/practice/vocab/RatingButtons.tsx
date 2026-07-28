import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { PreviewIntervals, ReviewRating } from '../../../services/learningService';

interface RatingButtonsProps {
  // null while the preview hasn't loaded yet — buttons stay usable, just
  // without a day-count badge (submitting never waits on this fetch, only
  // the display does).
  previewIntervals: PreviewIntervals | null;
  suggested?: ReviewRating;
  disabled?: boolean;
  onRate: (rating: ReviewRating) => void;
}

const RATINGS: ReviewRating[] = ['AGAIN', 'HARD', 'GOOD', 'EASY'];

const RATING_STYLES: Record<ReviewRating, string> = {
  AGAIN:
    'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 focus-visible:ring-rose-400',
  HARD: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 focus-visible:ring-amber-400',
  GOOD: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 focus-visible:ring-emerald-400',
  EASY: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 focus-visible:ring-blue-400',
};

const previewKeyFor = (rating: ReviewRating): keyof PreviewIntervals =>
  rating.toLowerCase() as keyof PreviewIntervals;

// Shared Again/Hard/Good/Easy row (Sprint 04C) — reused by FlashcardSession
// (always visible, no suggestion) and DictationSession (shown after
// checking, with a suggested rating highlighted but still requiring an
// explicit click — see each caller). Preview intervals are always
// backend-computed, never derived here (the frontend must not calculate
// scheduling).
const RatingButtons: React.FC<RatingButtonsProps> = ({ previewIntervals, suggested, disabled, onRate }) => {
  const { t } = useTranslation();
  const labels: Record<ReviewRating, string> = {
    AGAIN: t.practice.again,
    HARD: t.practice.hard,
    GOOD: t.practice.good,
    EASY: t.practice.easy,
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((rating) => (
        <button
          key={rating}
          type="button"
          disabled={disabled}
          onClick={() => onRate(rating)}
          aria-label={
            previewIntervals
              ? `${labels[rating]} — ${previewIntervals[previewKeyFor(rating)]} ${t.practice.daysUnit}`
              : labels[rating]
          }
          className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            RATING_STYLES[rating]
          } ${suggested === rating ? 'ring-2 ring-offset-1 ring-current' : ''}`}
        >
          <span>{labels[rating]}</span>
          {previewIntervals && (
            <span className="text-[10px] font-mono font-semibold opacity-70" aria-hidden="true">
              {previewIntervals[previewKeyFor(rating)]} {t.practice.daysUnit}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default RatingButtons;
