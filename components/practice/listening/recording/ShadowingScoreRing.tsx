import React from 'react';

// Sprint 11 Phase 4C — the verdict's accuracy, drawn as a ring.
//
// THE NUMBER IS THE SAME PROP `ShadowingHeaderBar` used to render as a pill.
// Phase 4C moved it here rather than adding a second copy: the header pill
// showed it once, and a ring beside the word chips is now the ONLY place it
// renders, per the same "one number, one place" rule `ShadowingResultPanel`
// already states for the row above it. Callers must not render this ring
// AND a separate accuracy figure for the same verdict.
//
// THE RING ITSELF IS DECORATIVE. The number is a normal, un-hidden text node —
// what a screen reader gets is the figure, not a description of an arc.

interface ShadowingScoreRingProps {
  percent: number;
  passed: boolean;
  label: string;
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ShadowingScoreRing: React.FC<ShadowingScoreRingProps> = ({
  percent,
  passed,
  label,
}) => {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * clamped) / 100;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative w-16 h-16 sm:w-20 sm:h-20">
        <svg aria-hidden="true" className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            strokeWidth="6"
            fill="transparent"
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            strokeWidth="6"
            strokeLinecap="round"
            fill="transparent"
            stroke={passed ? '#10B981' : '#F59E0B'}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 300ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
            {percent}%
          </span>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
};

export default ShadowingScoreRing;
