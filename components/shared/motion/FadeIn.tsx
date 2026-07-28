import React from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE } from './tokens';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

// The plainest entrance: opacity only, no movement. Use when something
// appears in place and moving it would be misleading (a status line
// changing, an inline result).
const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = DURATION.base,
  className,
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration, delay, ease: EASE }}
  >
    {children}
  </motion.div>
);

export default FadeIn;
