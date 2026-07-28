import React from 'react';

interface SkeletonProps {
  className?: string;
  // Sprint 06B.5 — opt in to a sweeping shimmer instead of the default
  // opacity pulse. Left opt-in so no existing call site changes behaviour;
  // the keyframe lives in index.html beside the other hand-written ones and
  // is gated behind prefers-reduced-motion there.
  variant?: 'pulse' | 'shimmer';
}

// Generic loading placeholder — a pulsing slate block. Used in place of a
// bare "Loading..." line wherever a shaped placeholder communicates the
// coming layout better (video regions, cards, list rows).
const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'pulse' }) => (
  <div
    className={`bg-slate-100 dark:bg-slate-800 rounded-2xl ${
      variant === 'shimmer' ? 'engmaster-shimmer' : 'animate-pulse'
    } ${className}`}
    aria-hidden="true"
  />
);

export default Skeleton;
