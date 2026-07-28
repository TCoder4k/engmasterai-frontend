import React from 'react';
import { motion } from 'framer-motion';
import { SPRING } from './tokens';

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  from?: number;
  className?: string;
}

// Spring "pop" for things that should feel like they landed: a tick mark, a
// selected badge, a completion icon. Deliberately springy rather than
// eased — this is the one place in the vocabulary where a bit of physical
// overshoot is the point.
const ScaleIn: React.FC<ScaleInProps> = ({
  children,
  delay = 0,
  from = 0.7,
  className,
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, scale: from }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: from }}
    transition={{ ...SPRING, delay }}
  >
    {children}
  </motion.div>
);

export default ScaleIn;
