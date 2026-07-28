import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { DURATION } from './tokens';

interface AnimatedCounterProps {
  // The real, final value. The animation only ever travels TOWARD this —
  // no intermediate figure is ever presented as a result in its own right.
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}

// Counts up to a real number.
//
// Two things this deliberately gets right:
//
// 1. Accessibility — the ticking figure is aria-hidden and a screen reader
//    is given only the FINAL value. Announcing every frame inside an
//    aria-live region would spam a listener with dozens of wrong numbers
//    before the right one.
// 2. Reduced motion — renders the final value immediately, no animation
//    frame at all.
const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = DURATION.slow,
  suffix = '',
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const totalMs = duration * 1000;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / totalMs, 1);
      // ease-out-cubic — fast start, gentle settle onto the real value.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduceMotion]);

  return (
    <span className={className}>
      <span aria-hidden="true">
        {display}
        {suffix}
      </span>
      <span className="sr-only">
        {value}
        {suffix}
      </span>
    </span>
  );
};

export default AnimatedCounter;
