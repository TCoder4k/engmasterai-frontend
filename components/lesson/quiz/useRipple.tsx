import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

let nextRippleId = 0;

// Sprint 06B.5 — the "you chose this" ripple.
//
// Deliberately says nothing about correctness: it fires the instant an
// option is picked, at which point the client genuinely does not know
// whether the answer is right (grading happens server-side, one round trip
// later). Acknowledging the CHOICE without implying a verdict is what lets
// the answering phase feel alive without lying to the student.
//
// Violet, and never emerald/rose — those are the app's correctness colours.
// It stayed violet when the accent moved to blue→indigo, which sharpens the
// point rather than blurring it: the ripple is now visibly neither the
// primary accent nor a verdict colour, so it can only read as "chosen".
export const useRipple = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const spawnRipple = useCallback((event?: React.MouseEvent<HTMLElement>) => {
    const id = nextRippleId++;
    let x = 50;
    let y = 50;

    // A real pointer event ripples from where it landed; a keyboard
    // selection has no coordinates, so it ripples from the centre.
    if (event && event.clientX !== 0 && event.clientY !== 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width) * 100;
      y = ((event.clientY - rect.top) / rect.height) * 100;
    }

    setRipples((prev) => [...prev, { id, x, y }]);
  }, []);

  const removeRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const rippleLayer = (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full bg-violet-400/30 dark:bg-violet-300/25"
          style={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
          }}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 22, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          onAnimationComplete={() => removeRipple(ripple.id)}
        />
      ))}
    </span>
  );

  return { spawnRipple, rippleLayer };
};
