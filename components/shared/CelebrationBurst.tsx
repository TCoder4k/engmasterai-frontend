import React from 'react';

interface CelebrationBurstProps {
  // Re-render (and re-fire) the burst whenever this changes; 0/undefined
  // renders nothing. Callers bump a counter on each correct answer.
  burstKey: number;
  // 'small' for a per-answer burst near the answer area, 'large' for the
  // session-complete card.
  size?: 'small' | 'large';
}

const PARTICLE_COLORS = ['#3B82F6', '#6366F1', '#F59E0B', '#10B981', '#EC4899'];

// Lightweight CSS particle burst (Sprint 03E): under 800ms, absolutely
// positioned inside a relative parent, aria-hidden (purely decorative —
// the mandatory feedback is the visible correct/incorrect text), and the
// particles are display:none entirely under prefers-reduced-motion (see
// index.html). No confetti package, no full-screen overlay.
const CelebrationBurst: React.FC<CelebrationBurstProps> = ({ burstKey, size = 'small' }) => {
  if (!burstKey) return null;

  const count = size === 'large' ? 14 : 8;
  const distance = size === 'large' ? 72 : 40;

  return (
    <div key={burstKey} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.round(Math.cos(angle) * distance);
        const y = Math.round(Math.sin(angle) * distance);
        return (
          <span
            key={i}
            className="practice-burst-particle absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full opacity-0"
            style={
              {
                backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                '--burst-x': `${x}px`,
                '--burst-y': `${y}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
};

export default CelebrationBurst;
