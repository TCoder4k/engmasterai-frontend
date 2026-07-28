import React from 'react';

interface QuizProgressBarProps {
  current: number; // 0-indexed
  total: number;
  answeredCount: number;
}

// Two signals, not one: position (current/total) and completion
// (answeredCount) — a student who jumped back to review question 1 should
// still see the bar reflect how much of the whole quiz is actually answered.
const QuizProgressBar: React.FC<QuizProgressBarProps> = ({ current, total, answeredCount }) => {
  const positionPercent = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
  const answeredPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="mb-4">
      <div className="w-full h-2 bg-slate-100 dark:bg-ink-800 rounded-full overflow-hidden relative">
        <div
          style={{ width: `${answeredPercent}%` }}
          className="h-full bg-emerald-400/60 dark:bg-emerald-500/40 rounded-full transition-all duration-300 absolute inset-y-0 left-0"
        />
        <div
          style={{ width: `${positionPercent}%` }}
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 absolute inset-y-0 left-0 mix-blend-multiply dark:mix-blend-screen opacity-70"
        />
      </div>
    </div>
  );
};

export default QuizProgressBar;
