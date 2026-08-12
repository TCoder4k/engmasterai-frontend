import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookMarked, BookOpen, CheckCircle2, RotateCw } from 'lucide-react';
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
   */
  newTotal?: number | null;
  /**
   * Compact tertiary stat folded into the bottom of this card rather than a
   * standalone row — same libraries-progress request as dueTotal/newTotal, so
   * no extra fetch. `null` = not known yet, and the line is simply omitted;
   * see UserHome.tsx.
   */
  masteredWords?: number | null;
  /**
   * `null` covers two things on purpose, both rendered the same way (percent
   * omitted): not loaded yet, OR loaded with zero total vocabulary — "no
   * library" and "library with nothing mastered yet" are different states,
   * and only the second is a real 0%.
   */
  masteredPercent?: number | null;
}

type Tone = 'blue' | 'emerald';

interface BranchContent {
  tone: Tone;
  icon: React.ReactNode;
  eyebrow: string;
  headline: string | null;
  subtitle: string | null;
  ctaLabel: string;
  ctaHref: string;
}

const TONE_CLASSES: Record<
  Tone,
  { card: string; iconTile: string; eyebrow: string; cta: string }
> = {
  // The one live action state (new words / due / both) — the app's calm
  // primary-action blue rather than "urgent" red, since review is routine,
  // not a warning.
  blue: {
    card: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    iconTile: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400',
    eyebrow: 'text-blue-700 dark:text-blue-400',
    cta: 'bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-400',
  },
  // Reserved for the genuinely-nothing-left-today state — distinct from the
  // action color on purpose, so "done" reads as a different kind of moment.
  emerald: {
    card: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    iconTile: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    eyebrow: 'text-emerald-700 dark:text-emerald-400',
    cta: 'bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-400',
  },
};

// Sprint 05 — the Dashboard's first actionable element, and the shortest
// path from login to reviewing: one click, without opening Vocabulary first.
//
// The counts are server-authoritative, from GET /learning/libraries/progress
// (Sprint 04D). There is no fallback number: if dueTotal is unknown this
// renders nothing at all, following the same silent-degrade rule
// VocabLibraryPage uses for the same request.
//
// The card's whole copy adapts to which of (dueTotal, newTotal) are nonzero,
// rather than reusing one "Review" title/CTA for every combination. A
// brand-new account has dueTotal === 0 forever (nothing has ever been rated),
// so a static "0 words to review" beside a review button reads as broken —
// see docs/memory.md for the report that prompted this. Four honest states:
// new-words-only, due-and-new, due-only, and genuinely nothing left today —
// the first three share one visual tone (below) so they read as one family
// of "come learn" banners, distinct from the "done" state's own color.
const ReviewDueCard: React.FC<ReviewDueCardProps> = ({
  dueTotal,
  newTotal = null,
  masteredWords = null,
  masteredPercent = null,
}) => {
  const { t } = useTranslation();

  if (dueTotal === null) return null;

  const newCount = newTotal ?? 0;
  const copy = t.dashboard.reviewCard;

  let branch: BranchContent;

  if (dueTotal === 0 && newCount === 0) {
    branch = {
      tone: 'emerald',
      icon: <CheckCircle2 size={26} />,
      eyebrow: copy.done.title,
      headline: null,
      subtitle: copy.done.body,
      ctaLabel: copy.done.cta,
      ctaHref: '/vocab',
    };
  } else if (dueTotal === 0) {
    // no word has ever been rated yet.
    const countText = (
      newCount === 1 ? copy.newOnly.countLabelOne : copy.newOnly.countLabel
    ).replace('{count}', String(newCount));
    branch = {
      tone: 'blue',
      icon: <BookOpen size={26} />,
      eyebrow: copy.newOnly.title,
      headline: countText,
      subtitle: copy.newOnly.subtitle,
      ctaLabel: copy.newOnly.cta,
      ctaHref: '/practice/review',
    };
  } else if (newCount === 0) {
    // the daily new-word quota is spent (or the library has none left), but
    // reviews are still due.
    const countText = (
      dueTotal === 1 ? copy.dueOnly.countLabelOne : copy.dueOnly.countLabel
    ).replace('{count}', String(dueTotal));
    branch = {
      tone: 'blue',
      icon: <RotateCw size={26} />,
      eyebrow: copy.dueOnly.title,
      headline: countText,
      subtitle: copy.dueOnly.subtitle,
      ctaLabel: copy.dueOnly.cta,
      ctaHref: '/practice/review',
    };
  } else {
    // both are shown, named separately rather than summed into one bigger
    // number, because they are different work: a due word is fading from
    // memory and has a cost to skipping it; a new word is optional progress.
    const dueText = (
      dueTotal === 1 ? copy.both.dueLabelOne : copy.both.dueLabel
    ).replace('{count}', String(dueTotal));
    const newText = (
      newCount === 1 ? copy.both.newLabelOne : copy.both.newLabel
    ).replace('{count}', String(newCount));
    branch = {
      tone: 'blue',
      icon: <BookOpen size={26} />,
      eyebrow: copy.both.title,
      headline: dueText,
      subtitle: newText,
      ctaLabel: copy.both.cta,
      ctaHref: '/practice/review',
    };
  }

  const tone = TONE_CLASSES[branch.tone];

  return (
    <section
      aria-label={branch.eyebrow}
      className={`rounded-2xl border p-6 space-y-4 ${tone.card}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${tone.iconTile}`}
          aria-hidden="true"
        >
          {branch.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${tone.eyebrow}`}>
            {branch.eyebrow}
          </p>
          {branch.headline && (
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {branch.headline}
            </p>
          )}
          {branch.subtitle && (
            <p
              className={`font-semibold mt-0.5 ${
                branch.headline
                  ? 'text-xs text-slate-600 dark:text-slate-400'
                  : 'text-sm text-slate-700 dark:text-slate-300'
              }`}
            >
              {branch.subtitle}
            </p>
          )}
        </div>
        <Link
          to={branch.ctaHref}
          className={`inline-flex items-center justify-center gap-1.5 flex-shrink-0 text-sm font-bold text-white px-6 py-3 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 ${tone.cta}`}
        >
          <span>{branch.ctaLabel}</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {masteredWords !== null && (
        <div className="pt-3 border-t border-slate-200/70 dark:border-ink-700/60 flex items-center gap-1.5">
          <BookMarked
            size={14}
            className="text-slate-400 dark:text-slate-500 flex-shrink-0"
            aria-hidden="true"
          />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {copy.masterySummary.replace('{count}', String(masteredWords))}
            {masteredPercent !== null && (
              <span className="text-slate-400 dark:text-slate-500 font-semibold">
                {' · '}
                {copy.masteryPercent.replace('{percent}', String(masteredPercent))}
              </span>
            )}
          </p>
        </div>
      )}
    </section>
  );
};

export default ReviewDueCard;
