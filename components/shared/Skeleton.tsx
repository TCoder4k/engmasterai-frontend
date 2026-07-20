import React from 'react';

interface SkeletonProps {
  className?: string;
}

// Generic loading placeholder — a pulsing slate block. Used in place of a
// bare "Loading..." line wherever a shaped placeholder communicates the
// coming layout better (video regions, cards, list rows).
const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl ${className}`} aria-hidden="true" />
);

export default Skeleton;
