import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Sprint 10 QA — one back control for the student-facing pages.
//
// WHY A COMPONENT. Six pages had copy-pasted the same six-line `<Link>` and
// they had already drifted: `space-x-1.5` on four of them and `gap-1.5` on the
// others, `mb-8` on some and not others, and two variants that had lost the
// arrow icon and the 44px touch target entirely. None of that was visible from
// any single file.
//
// WHY A PILL AND NOT THE OLD TEXT LINK. The old one rendered at `text-xs` in
// `text-slate-400` — the same weight and colour as the disabled and caption
// text around it, so on a lesson page it read as a label rather than as the
// control that leaves the page. Reported in QA as "the back buttons are hard
// to notice".
//
// IT IS ALWAYS A <Link>, never `navigate(-1)`. Every back control in this
// codebase already targets an explicit route, and that is the better
// behaviour: history-back lands wherever the student happened to come from,
// which for a lesson reached from a search result or a bookmark is not the
// course page the label promises.
//
// SCOPE. Deliberately applied to page-level back links only. The icon-only
// buttons in the practice session headers, the exit buttons on the summary
// screens and the "previous question" steppers are different controls that
// happen to point left — see the audit in the Sprint 10 QA notes.

interface BackButtonProps {
  /** Explicit destination route. */
  to: string;
  /** Already-localised label. The component holds no copy of its own. */
  label: string;
  /** Router state, for the pages that carry a breadcrumb through navigation. */
  state?: unknown;
  /**
   * Spacing only. Layouts differ — some parents drive the gap with
   * `space-y-*`, some need the margin here — and that is the one thing this
   * component should not decide for them.
   */
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  to,
  label,
  state,
  className = '',
}) => (
  <Link
    to={to}
    state={state}
    className={[
      // min-h/px pair keeps the touch target at 44px without the label
      // deciding the height, so a long VI string and a short EN one are the
      // same size and neither shifts the layout under it.
      'inline-flex items-center gap-2 rounded-full px-4 py-2.5 min-h-[44px]',
      'text-xs font-bold',
      // High contrast in both themes, and it sits on the slate-* surfaces the
      // app uses everywhere as well as the ink-* ones the lesson module uses.
      'bg-slate-800 text-white hover:bg-slate-700',
      'dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
      // Colour only — no transform, so nothing below it moves on hover.
      'transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2',
      'focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <ArrowLeft size={16} aria-hidden="true" />
    {label}
  </Link>
);

export default BackButton;
