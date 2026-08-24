import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireStreakMilestoneConfetti } from './streakCelebrationConfetti';

// jsdom has no real 2D canvas context — exactly the environment this must
// survive: canvas-confetti's internal failure must never escape as a throw
// ("confetti is decorative only", same contract as feedbackSounds.ts).
describe('fireStreakMilestoneConfetti', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('never throws, even without a working canvas', () => {
    vi.useFakeTimers();
    expect(() => {
      fireStreakMilestoneConfetti();
      vi.runAllTimers();
    }).not.toThrow();
  });

  it('does nothing when the viewer prefers reduced motion', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', matchMedia);

    expect(() => fireStreakMilestoneConfetti()).not.toThrow();
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

    vi.unstubAllGlobals();
  });
});
