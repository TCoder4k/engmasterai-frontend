import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface PlacementProgressBarProps {
  current: number; // 0-indexed
  total: number;
}

// Placement-only progress bar: a single flat determinate fill plus a
// "X/Y câu" numeric label, matching the mockup. Deliberately NOT a variant
// of the shared QuizProgressBar — that component's dual-layer
// "answered % vs. position % blend" is a different visual model used
// elsewhere in the quiz engine as-is, and overloading it here would risk
// that other UI rather than share a genuinely common shape.
const PlacementProgressBar: React.FC<PlacementProgressBarProps> = ({ current, total }) => {
  const { t } = useTranslation();
  const percent = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;

  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-ink-800 rounded-full overflow-hidden">
        <div
          style={{ width: `${percent}%` }}
          className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
        />
      </div>
      <span className="flex-shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
        {t.onboarding.testProgressLabel(Math.min(current + 1, total), total)}
      </span>
    </div>
  );
};

export default PlacementProgressBar;
