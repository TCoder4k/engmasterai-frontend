import confetti from 'canvas-confetti';

// Streak Together — the multi-stage confetti burst for a milestone crossing
// (1/3/7/30/100 days). canvas-confetti renders to its own full-window
// canvas at 60fps rather than a GIF/video asset; it's the one exception to
// this app's "no confetti package" rule (CelebrationBurst.tsx), reserved for
// this rare, once-per-milestone moment rather than the frequent per-answer
// bursts practice sessions already use CelebrationBurst for.
//
// Every call is wrapped so a canvas failure (no 2D context, e.g. under
// jsdom in tests) can never break the celebration flow — same fail-safe
// contract as feedbackSounds.ts.
const safeFire = (options: confetti.Options): void => {
  try {
    void confetti(options);
  } catch {
    // Confetti is decorative only — never let it throw.
  }
};

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const fireStreakMilestoneConfetti = (): void => {
  // Same reduced-motion contract as CelebrationBurst.tsx's CSS particles.
  if (prefersReducedMotion()) return;

  // Stage 1 — a flame-toned burst from the centre.
  safeFire({
    particleCount: 80,
    spread: 100,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#FF5722', '#FF9800', '#FFC107', '#FF3D00', '#FFEB3B'],
    startVelocity: 45,
    gravity: 0.9,
  });

  // Stage 2 — two side cannons.
  setTimeout(() => {
    safeFire({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: ['#6366F1', '#EC4899', '#3B82F6', '#F59E0B', '#10B981'],
    });
    safeFire({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: ['#6366F1', '#EC4899', '#3B82F6', '#F59E0B', '#10B981'],
    });
  }, 250);

  // Stage 3 — a gentler shower of gold stars from above.
  setTimeout(() => {
    safeFire({
      particleCount: 40,
      spread: 120,
      origin: { x: 0.5, y: 0.3 },
      colors: ['#F59E0B', '#FBBF24', '#FFFFFF'],
      shapes: ['star'],
      gravity: 0.6,
    });
  }, 500);
};
