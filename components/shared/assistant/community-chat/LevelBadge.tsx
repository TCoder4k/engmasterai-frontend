import React from 'react';

interface LevelBadgeProps {
  level: number;
}

// A compact "Lv.N" pill — no such primitive exists elsewhere in the app
// (LevelWidget.tsx is a full sidebar gauge card, not a pill). Always renders
// from the server-projected author.level attached to a specific message,
// never from useGamification() — that hook only knows the CURRENT user's
// level, but every message (including the current user's own) needs to show
// whatever level its actual author had at send time.
const LevelBadge: React.FC<LevelBadgeProps> = ({ level }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold leading-none">
    Lv.{level}
  </span>
);

export default LevelBadge;
