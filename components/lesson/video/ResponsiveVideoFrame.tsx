import React from 'react';

interface ResponsiveVideoFrameProps {
  children: React.ReactNode;
}

// Fixed-16:9 aspect-ratio container (Tailwind's `aspect-video` utility) so
// the YouTube iframe scales correctly at every breakpoint without a
// layout shift on load. The one place aspect-ratio math lives — every
// video state (loading/player/unavailable/resume-prompt) renders inside
// this same box via absolute positioning.
const ResponsiveVideoFrame: React.FC<ResponsiveVideoFrameProps> = ({ children }) => (
  <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden">{children}</div>
);

export default ResponsiveVideoFrame;
