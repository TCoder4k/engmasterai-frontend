import React from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE, SLIDE_DISTANCE } from './tokens';

interface SlideLeftProps {
  children: React.ReactNode;
  // +1 = moving forward (exit left, enter from the right)
  // -1 = moving back    (exit right, enter from the left)
  // Direction matters: a Previous that still slides forward reads as
  // broken, because the motion contradicts the navigation.
  direction?: 1 | -1;
  duration?: number;
  distance?: number;
  className?: string;
}

// Horizontal question-to-question / step-to-step transition. Designed to be
// used inside <AnimatePresence mode="wait"> with a `key` on this element,
// so the outgoing child finishes its exit before the next one enters.
const SlideLeft: React.FC<SlideLeftProps> = ({
  children,
  direction = 1,
  duration = DURATION.base,
  distance = SLIDE_DISTANCE,
  className,
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, x: direction * distance }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: direction * -distance }}
    transition={{ duration, ease: EASE }}
  >
    {children}
  </motion.div>
);

export default SlideLeft;
