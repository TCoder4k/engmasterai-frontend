import React from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE, RISE_DISTANCE, STAGGER_STEP } from './tokens';

interface StaggerContainerProps {
  children: React.ReactNode;
  step?: number;
  delay?: number;
  className?: string;
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

// Parent/child pair for revealing a list or grid in sequence. The parent
// orchestrates timing so children don't each need their own delay, which
// keeps the stagger correct when the number of items changes.
//
// Use for genuinely parallel items (stat tiles, a card grid). Do NOT use it
// to reveal a single block of prose one line at a time — that reads as the
// UI withholding information the reader already asked for.
export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  step = STAGGER_STEP,
  delay = 0,
  className,
}) => (
  <motion.div
    className={className}
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: step, delayChildren: delay } },
    }}
  >
    {children}
  </motion.div>
);

export const StaggerItem: React.FC<StaggerItemProps> = ({
  children,
  className,
}) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: RISE_DISTANCE },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.base, ease: EASE },
      },
    }}
  >
    {children}
  </motion.div>
);

export default StaggerContainer;
