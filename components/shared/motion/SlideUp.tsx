import React from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE, RISE_DISTANCE } from './tokens';

interface SlideUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
}

// The default "content arrives" primitive — a short rise plus a fade. This
// is the one to reach for unless there's a reason not to.
const SlideUp: React.FC<SlideUpProps> = ({
  children,
  delay = 0,
  duration = DURATION.base,
  distance = RISE_DISTANCE,
  className,
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: distance }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -distance }}
    transition={{ duration, delay, ease: EASE }}
  >
    {children}
  </motion.div>
);

export default SlideUp;
