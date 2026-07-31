import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface ReviewDueCardProps {
  // null means "not known" — still loading, or the supplementary progress
  // fetch failed. It is NOT the same as 0, and must never render as one.
  dueTotal: number | null;
  /**
   * New words a session started now would introduce, from the same request.
   *
   * WHY THIS PROP EXISTS. This card used to show `dueTotal` alone and call it
   * "23 từ đang chờ" — then the session opened with "Còn lại: 38". Both numbers
   * were right and they meant different things: `dueTotal` counts words already
   * learned and now due, while the queue is topped up with new words. The card
   * promised a number the next screen contradicted, and nothing explained it.
   *
   * The two are shown SEPARATELY rather than summed into one bigger number,
   * because they are different work: a due word is fading from memory and has a
   * cost to skipping it; a new word is optional progress.
   */
  newTotal?: number | null;
}

// Sprint 05 — the Dashboard's first actionable element, and the shortest
// path from login to reviewing: one click, without opening Vocabulary first.
//
// The count is server-authoritative, summed from
// GET /learning/libraries/progress (Sprint 04D). There is no fallback
// number: if the total is unknown this renders nothing at all, following the
// same silent-degrade rule VocabLibraryPage uses for the same request.
const ReviewDueCard: React.FC<ReviewDueCardProps> = ({
  dueTotal,
  newTotal = null,
}) => {
  const { t } = useTranslation();

  if (dueTotal === null) return null;

  const newCount = newTotal ?? 0;

  // Honest zero state — a quiet line rather than a hidden section, so the
  // page does not reflow once the count arrives. Only when there is genuinely
  // nothing to do: new words alone are still a reason to open the session.
  if (dueTotal === 0 && newCount === 0) {
    return (
      <p className="text-[13px] font-semibold text-slate-400 dark:text-slate-500">
        {t.dashboard.nothingDueToday}
      </p>
    );
  }

  return (
    <section
      aria-label={t.dashboard.reviewDueTitle}
      className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div
        className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0"
        aria-hidden="true"
      >
        <Flame size={24} className="fill-current" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
          {t.dashboard.reviewDueTitle}
        </p>
        <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
          {dueTotal} {dueTotal === 1 ? t.dashboard.oneWordWaiting : t.dashboard.wordsWaiting}
        </p>
        {/* The queue's other half, named rather than silently folded into the
            number above. Omitted entirely when there are none — and when the
            count is unknown, since `newTotal` null must never render as 0. */}
        {newTotal !== null && newTotal > 0 && (
          <p className="text-xs font-semibold text-amber-700/80 dark:text-amber-400/80 mt-0.5">
            + {newTotal} {t.dashboard.newWordsInSession}
          </p>
        )}
      </div>

      <Link
        to="/practice/review"
        className="inline-flex items-center justify-center gap-1.5 flex-shrink-0 text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <span>{t.dashboard.reviewNow}</span>
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
};

export default ReviewDueCard;
