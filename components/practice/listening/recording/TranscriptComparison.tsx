import React from 'react';
import { Check, AlertTriangle, X, Plus } from 'lucide-react';
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

  const chipStyle = (op: ShadowingAlignmentToken['op']) => {
    switch (op) {
      case 'MATCH':
        return {
          className:
            'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/60 text-emerald-700 dark:text-emerald-300',
          icon: <Check size={13} aria-hidden="true" className="shrink-0" />,
          strike: false,
        };
      case 'SUBSTITUTE':
        return {
          className:
            'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/60 text-amber-700 dark:text-amber-300',
          icon: <AlertTriangle size={13} aria-hidden="true" className="shrink-0" />,
          strike: false,
        };
      case 'DELETE':
        return {
          className:
            'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/60 text-rose-700 dark:text-rose-300',
          icon: <X size={13} aria-hidden="true" className="shrink-0" />,
          strike: true,
        };
      case 'INSERT':
        return {
          className:
            'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 border-dashed',
          icon: <Plus size={13} aria-hidden="true" className="shrink-0" />,
          strike: false,
        };
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {t.practice.shadowingComparisonTitle}
      </p>

      <div
        className="flex flex-wrap items-center gap-2"
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold ${style.className}`}
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
              {style.icon}
            </span>
          );
        })}
      </div>

      {/* A key, because four visual treatments are not self-explanatory and a
          student should not have to hover to learn them. */}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <Check size={11} aria-hidden="true" />
          {t.practice.shadowingTokenCorrect}
        </span>
        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <AlertTriangle size={11} aria-hidden="true" />
          {t.practice.shadowingTokenWrong}
        </span>
        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
          <X size={11} aria-hidden="true" />
          {t.practice.shadowingTokenMissing}
        </span>
        <span className="inline-flex items-center gap-1">
          <Plus size={11} aria-hidden="true" />
          {t.practice.shadowingTokenExtra}
        </span>
      </p>
    </div>
  );
};

export default TranscriptComparison;
