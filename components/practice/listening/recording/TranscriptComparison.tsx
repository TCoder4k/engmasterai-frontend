import React from 'react';
import { Check, X, Plus } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import type { ShadowingAlignmentToken } from '../../../../services/listeningService';

// Sprint 11 Phase 4B — what the student said, against what they should have.
//
// EVERY TOKEN COMES FROM THE SERVER. This component computes nothing: it does
// not diff, does not count and does not derive an accuracy from what it is
// rendering. A client that can recompute the score can disagree with the
// server about it, and there is only supposed to be one answer.
//
// COLOUR IS NEVER THE ONLY CARRIER. Phase 4C moved from styled words to chips,
// and the carrier moved with it: each chip now shows an ICON naming its verdict
// (tick / warning / cross / plus) alongside the colour, a missing word keeps its
// strike-through, and every chip still has an `aria-label` in words. A student
// with deuteranopia reading a red-and-green diff of their own speech gets
// nothing from the colours, and this is exactly the surface where "which word
// did I get wrong?" is the entire question being asked.

interface TranscriptComparisonProps {
  tokens: ShadowingAlignmentToken[];
}

const TranscriptComparison: React.FC<TranscriptComparisonProps> = ({ tokens }) => {
  const { t } = useTranslation();

  if (tokens.length === 0) return null;

  const describe = (token: ShadowingAlignmentToken): string => {
    switch (token.op) {
      case 'MATCH':
        return t.practice.shadowingTokenCorrect;
      case 'SUBSTITUTE':
        return t.practice.shadowingTokenWrong;
      case 'DELETE':
        return t.practice.shadowingTokenMissing;
      case 'INSERT':
        return t.practice.shadowingTokenExtra;
    }
  };

  // Sprint 11 Phase 4C dark redesign — pale, high-contrast chips deliberately
  // NOT dark-on-dark: this is the surface where "which word did I get wrong?"
  // is the entire question, and a wash of colour needs to read at a glance
  // against the card behind it. The badge is a small circle overlapping the
  // chip's corner rather than an inline icon, which is what makes room for
  // a per-chip verdict AND the word itself without crowding a five-letter chip.
  //
  // Sprint 11 Phase 3.4 — three colours, not four: correct is green, wrong is
  // red, and MISSING/EXTRA share one grey rather than each getting its own
  // hue. Amber is gone entirely — a fourth colour for "wrong" was one more
  // distinction a student had to learn without one more thing to say. Missing
  // and extra still read apart from each other without colour (strike-through
  // + X vs. a dashed border + plus), which is the whole point of never making
  // colour the only carrier.
  const chipStyle = (op: ShadowingAlignmentToken['op']) => {
    switch (op) {
      case 'MATCH':
        return {
          className: 'bg-emerald-50 border-emerald-300 text-emerald-900',
          badgeClassName: 'bg-emerald-500 text-white',
          badgeIcon: <Check size={11} aria-hidden="true" strokeWidth={3} />,
          strike: false,
        };
      case 'SUBSTITUTE':
        return {
          className: 'bg-rose-50 border-rose-300 text-rose-900',
          badgeClassName: 'bg-rose-500 text-white',
          badgeIcon: (
            <span aria-hidden="true" className="text-[10px] font-black leading-none">
              ~
            </span>
          ),
          strike: false,
        };
      case 'DELETE':
        return {
          className: 'bg-slate-100 border-slate-300 text-slate-600',
          badgeClassName: 'bg-slate-500 text-white',
          badgeIcon: <X size={11} aria-hidden="true" strokeWidth={3} />,
          strike: true,
        };
      case 'INSERT':
        return {
          className: 'bg-slate-100 border-slate-300 border-dashed text-slate-600',
          badgeClassName: 'bg-slate-500 text-white',
          badgeIcon: <Plus size={11} aria-hidden="true" strokeWidth={3} />,
          strike: false,
        };
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-500">
        {t.practice.shadowingComparisonTitle}
      </p>

      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="transcript-comparison"
      >
        {tokens.map((token, index) => {
          // The word shown is the REFERENCE for everything except an
          // insertion, where there is no reference word — an extra word is
          // only meaningful as the thing the student actually said.
          const word = token.op === 'INSERT' ? token.spoken : token.reference;
          const label = `${word ?? ''}: ${describe(token)}`;
          const style = chipStyle(token.op);

          return (
            <span
              key={index}
              aria-label={label}
              title={label}
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold ${style.className}`}
            >
              <span className={style.strike ? 'line-through' : undefined}>{word}</span>
              {/* What they said instead, inline. Shown only for a substitution:
                  "you said X" next to a word they got right is noise, and next
                  to a missing word there is nothing to show. */}
              {token.op === 'SUBSTITUTE' && token.spoken && (
                <span className="text-[11px] font-semibold opacity-80">
                  ({token.spoken})
                </span>
              )}
              <span
                aria-hidden="true"
                className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#0B132B] ${style.badgeClassName}`}
              >
                {style.badgeIcon}
              </span>
            </span>
          );
        })}
      </div>

      {/* A key, because four visual treatments are not self-explanatory and a
          student should not have to hover to learn them. */}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 dark:text-slate-500">
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check size={11} aria-hidden="true" />
          {t.practice.shadowingTokenCorrect}
        </span>
        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
          <span aria-hidden="true" className="font-black">~</span>
          {t.practice.shadowingTokenWrong}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <X size={11} aria-hidden="true" />
          {t.practice.shadowingTokenMissing}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Plus size={11} aria-hidden="true" />
          {t.practice.shadowingTokenExtra}
        </span>
      </p>
    </div>
  );
};

export default TranscriptComparison;
