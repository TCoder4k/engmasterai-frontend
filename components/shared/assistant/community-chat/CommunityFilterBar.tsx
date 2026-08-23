import React from 'react';

export interface CommunityFilterChip {
  id: string;
  label: string;
}

interface CommunityFilterBarProps {
  filters: CommunityFilterChip[];
  activeFilterId: string;
}

// A config array with exactly ONE working entry ("Tất cả") for this MVP —
// the backend has no trending ("Hot") or friends/follow concept to back the
// other chips from the original mockup with real data, and this codebase
// has an established "don't render non-functional placeholders" discipline
// (removed elsewhere in the Admin Dashboard for the same reason). Kept as a
// config array specifically so restoring more chips later is additive, not
// a rewrite. Non-interactive for now (a single always-active chip has
// nothing to switch to) rather than a disabled/"Sắp có" button.
const CommunityFilterBar: React.FC<CommunityFilterBarProps> = ({ filters, activeFilterId }) => (
  <div className="flex items-center gap-1.5 px-4 py-2 shrink-0 overflow-x-auto">
    {filters.map((filter) => {
      const active = filter.id === activeFilterId;
      return (
        <span
          key={filter.id}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
            active
              ? 'bg-violet-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          {filter.label}
        </span>
      );
    })}
  </div>
);

export default CommunityFilterBar;
