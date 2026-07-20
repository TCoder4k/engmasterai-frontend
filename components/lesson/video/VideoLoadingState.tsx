import React from 'react';

// Shown while the IFrame API script loads and the player initializes —
// never a blank box. pointer-events-none: this overlaps the embed briefly
// during the loading→ready transition and must never intercept a tap
// meant for the player underneath/after it.
const VideoLoadingState: React.FC = () => (
  <div className="absolute inset-0 animate-pulse bg-slate-900 pointer-events-none" aria-hidden="true" />
);

export default VideoLoadingState;
