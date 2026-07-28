import React from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE, RISE_DISTANCE } from './tokens';

interface RevealOnScrollProps {
  children: React.ReactNode;
  /** Seconds. Use a small multiple of the index to stagger a row of cards. */
  delay?: number;
  className?: string;
  /** Rendered element. `li`/`article` keep list and section semantics intact. */
  as?: 'div' | 'li' | 'article' | 'section';
}

// Content that rises into place the first time it is scrolled to.
//
// `once: true` is the whole point: a section that re-animates every time it
// scrolls back into view turns a page into a slideshow. `amount: 0.15` fires
// as soon as a sliver is visible, so a tall card is never still blank by the
// time the reader reaches it.
//
// Sits here rather than in the landing page because it is the one motion
// pattern every long scrolling page wants, and the whole reason
// components/shared/motion exists is that timing stays one decision.
//
// Under `prefers-reduced-motion` the app-root MotionConfig resolves this
// instantly, so the content is simply there.
const RevealOnScroll: React.FC<RevealOnScrollProps> = ({
  children,
  delay = 0,
  className,
  as = 'div',
}) => {
  const Component = motion[as];

  return (
    <Component
      initial={{ opacity: 0, y: RISE_DISTANCE }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: DURATION.base, ease: EASE, delay }}
      className={className}
    >
      {children}
    </Component>
  );
};

export default RevealOnScroll;
