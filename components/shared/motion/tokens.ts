// Sprint 06B.5 — the app's motion vocabulary, in one place.
//
// These values are not invented: they match the motion language the landing
// redesign already established with Tailwind utilities (`transition-all
// duration-300`, `hover:-translate-y-1`, `hover:-translate-y-0.5`,
// `active:translate-y-0`, `group-hover:scale-110`), so JS-driven and
// CSS-driven motion in this app read as one system rather than two.
//
// Framer Motion durations are in SECONDS, not milliseconds.

export const DURATION = {
  // Hover and press only. 80ms is around the threshold where a press still
  // feels like a direct physical response; stretch it to 300ms and the same
  // interaction reads as laggy.
  micro: 0.08,
  // Small state changes — a badge swapping, a ring settling.
  fast: 0.15,
  // The default. Matches the `duration-300` used across the landing page.
  base: 0.3,
  // Deliberate, noticeable moments: a celebration, a stage crossfade.
  slow: 0.6,
} as const;

// ease-out-quart. Fast to start, long gentle settle — the shape that reads
// as "arriving" rather than "being pushed".
export const EASE = [0.22, 1, 0.36, 1] as const;

// For anything that should feel physical: a selected badge popping, a tick
// landing. Slightly over-damped so it settles without a visible wobble.
export const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const;

// Horizontal travel for question-to-question transitions, in pixels. Small
// on purpose: a large slide turns navigation into a scene change.
export const SLIDE_DISTANCE = 24;

// Vertical travel for content arriving.
export const RISE_DISTANCE = 12;

// Default gap between staggered children.
export const STAGGER_STEP = 0.06;
