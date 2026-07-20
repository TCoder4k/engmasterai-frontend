import React, { useEffect, useRef } from 'react';
import { loadYouTubeIframeApi } from '../../../services/youtubeApiLoader';

interface YouTubeEmbedProps {
  videoId: string;
  onReady: (player: any) => void;
  onStateChange: (state: number) => void;
  onError: () => void;
}

// Thin wrapper around the actual IFrame Player API instance — owns only
// the player's lifecycle wiring (create on mount, destroy on unmount/id
// change), exposing events upward via props. No resume/localStorage logic
// lives here; that belongs to LessonVideoPlayer.
//
// `host: 'https://www.youtube-nocookie.com'` selects the privacy-enhanced
// embed (design doc §7.4.2): YouTube does not set tracking cookies for a
// viewer who hasn't interacted with the player yet. This does not remove
// every privacy/tracking concern — once played, YouTube can still set
// cookies and collect view data as part of operating the embedded player.
//
// MOBILE-UNCLICKABLE FIX (CSS-only, no onReady race, no overlay above the
// iframe): `new YT.Player(el)` REPLACES `el` with a bare <iframe> that
// inherits none of `el`'s classes, so the iframe otherwise falls back to
// YouTube's default sizing and no longer fills the visible 16:9 box.
// - We keep a React-owned wrapper (so React can unmount cleanly — YT
//   destroys the inner div, not our wrapper) but give it `display:contents`
//   so it generates NO box of its own. There is therefore no intermediate
//   `absolute inset-0` layer sitting over the iframe to intercept touches.
// - The injected iframe is positioned by a static CSS rule in index.html
//   (`.yt-player-frame > iframe { position:absolute; inset:0; ... }`). Since
//   the wrapper has no box, the iframe's absolute positioning resolves
//   against ResponsiveVideoFrame (the nearest `relative` ancestor), filling
//   the 16:9 frame exactly. The rule exists before the iframe is created, so
//   it applies instantly — zero dependency on the async onReady.
const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoId, onReady, onStateChange, onError }) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const callbacksRef = useRef({ onReady, onStateChange, onError });
  callbacksRef.current = { onReady, onStateChange, onError };

  useEffect(() => {
    let cancelled = false;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !targetRef.current) return;
        playerRef.current = new YT.Player(targetRef.current, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1 },
          events: {
            onReady: (event: any) => callbacksRef.current.onReady(event.target),
            onStateChange: (event: any) => callbacksRef.current.onStateChange(event.data),
            onError: () => callbacksRef.current.onError(),
          },
        });
      })
      .catch(() => callbacksRef.current.onError());

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Player may already be torn down by the API itself — safe to ignore.
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // `contents` = no box, so this wrapper never overlays the iframe; the
  // `yt-player-frame` class hooks the static positioning rule (index.html)
  // onto the iframe YouTube injects in place of the inner target div.
  return (
    <div className="yt-player-frame contents">
      <div ref={targetRef} />
    </div>
  );
};

export default YouTubeEmbed;
