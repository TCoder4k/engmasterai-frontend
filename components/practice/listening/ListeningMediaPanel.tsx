import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import ResponsiveVideoFrame from '../../lesson/video/ResponsiveVideoFrame';
import VideoLoadingState from '../../lesson/video/VideoLoadingState';
import VideoUnavailableState from '../../lesson/video/VideoUnavailableState';
import YouTubeEmbed from '../../lesson/video/YouTubeEmbed';
import { parseYouTubeVideoId } from '../../lesson/video/youtubeUrlParser';
import { useTranslation } from '../../../i18n/useTranslation';
import type { ListeningContentDetail } from '../../../services/listeningService';
import type { MediaController } from './useSegmentPlayback';

// Sprint 11 Phase 2 — renders whichever provider a recording uses and hands a
// uniform `MediaController` upward.
//
// TWO PROVIDERS SHIP IN THIS PHASE: YOUTUBE+VIDEO and EXTERNAL_URL+AUDIO. The
// adapters are the ONLY provider-specific code in the listening player; the
// transport bar, the segment list and useSegmentPlayback are all written
// against the interface and have never heard of YouTube.
//
// LessonVideoPlayer is deliberately NOT reused. It is welded to
// `recordVideoProgress`/LessonStepProgress — mounting it here would post
// lesson-step progress for a recording that is not a lesson and has no step.
// Its genuinely reusable parts (the embed, the frame, the two states) are
// imported individually instead, which is why they were extracted.
//
// AUDIO USES THE NATIVE ELEMENT WITH CONTROLS. A hand-built transport would
// have to re-implement buffering, keyboard access and the OS media session for
// no gain; the segment controls sit above it and drive the same element.
//
// NOTHING AUTOPLAYS. Neither branch calls play() on mount — playback only
// starts from a student gesture, which is both the app's locked rule and a
// hard requirement on iOS Safari.

const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 };

// HTMLMediaElement accepts an arbitrary positive playbackRate, so unlike the
// YouTube branch there is no capability list to ask for. This is the offered
// set, not an assumption about the provider.
const AUDIO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5];

interface ListeningMediaPanelProps {
  content: ListeningContentDetail;
  /** Null whenever no provider is ready — the caller must treat it as "not yet playable". */
  onControllerChange: (controller: MediaController | null) => void;
  /** REAL provider playback state, not the app's intent to play. */
  onPlayingChange: (playing: boolean) => void;
}

const ListeningMediaPanel: React.FC<ListeningMediaPanelProps> = ({
  content,
  onControllerChange,
  onPlayingChange,
}) => {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Bumping this remounts the embed, which is what "try again" has to do —
  // the IFrame API gives no reload for a player that failed to construct.
  const [retryKey, setRetryKey] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const callbacksRef = useRef({ onControllerChange, onPlayingChange });
  callbacksRef.current = { onControllerChange, onPlayingChange };

  const isYouTube =
    content.mediaProvider === 'YOUTUBE' && content.mediaType === 'VIDEO';
  const videoId = isYouTube
    ? content.externalMediaId || parseYouTubeVideoId(content.mediaUrl)
    : null;

  // A recording that reaches a student always passed publish validation, so a
  // missing/unparseable URL here means the media broke AFTER publication.
  // Render the same honest failure surface as a deleted video rather than
  // handing an empty string to a player.
  const unplayable = isYouTube ? !videoId : !content.mediaUrl;

  const handleRetry = useCallback(() => {
    setFailed(false);
    setReady(false);
    setRetryKey((key) => key + 1);
  }, []);

  // Report "no controller" whenever the media cannot be driven, so the
  // transport bar disables instead of pretending.
  useEffect(() => {
    if (unplayable || failed) {
      callbacksRef.current.onControllerChange(null);
      callbacksRef.current.onPlayingChange(false);
    }
  }, [unplayable, failed]);

  useEffect(
    () => () => {
      callbacksRef.current.onControllerChange(null);
      callbacksRef.current.onPlayingChange(false);
    },
    [],
  );

  const handleYouTubeReady = useCallback((player: any) => {
    setReady(true);
    callbacksRef.current.onControllerChange({
      play: () => player.playVideo(),
      pause: () => player.pauseVideo(),
      // allowSeekAhead=true — the student jumps to an arbitrary sentence, so
      // seeking must work outside the already-buffered range.
      seekTo: (seconds: number) => player.seekTo(seconds, true),
      getCurrentTime: () => player.getCurrentTime() ?? 0,
      setPlaybackRate: (rate: number) => player.setPlaybackRate(rate),
      getAvailablePlaybackRates: () =>
        player.getAvailablePlaybackRates?.() ?? [1],
    });
  }, []);

  const handleYouTubeStateChange = useCallback((state: number) => {
    callbacksRef.current.onPlayingChange(state === PLAYER_STATE.PLAYING);
  }, []);

  const handleYouTubeError = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);

  const handleAudioReady = useCallback(() => {
    const element = audioRef.current;
    if (!element) return;
    setReady(true);
    callbacksRef.current.onControllerChange({
      play: () => {
        // A rejected play() is an autoplay-policy refusal, not a crash. The
        // element stays paused and `onPlayingChange` never fires, so the UI
        // continues to say "paused" — which is the truth.
        void element.play().catch(() => undefined);
      },
      pause: () => element.pause(),
      seekTo: (seconds: number) => {
        element.currentTime = seconds;
      },
      getCurrentTime: () => element.currentTime,
      setPlaybackRate: (rate: number) => {
        element.playbackRate = rate;
      },
      getAvailablePlaybackRates: () => AUDIO_PLAYBACK_RATES,
    });
  }, []);

  const attribution = content.sourceName && (
    <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
      {t.practice.listeningSourceLabel}:{' '}
      {content.sourceUrl ? (
        <a
          href={content.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          {content.sourceName}
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      ) : (
        <span>{content.sourceName}</span>
      )}
    </p>
  );

  if (unplayable || failed) {
    return (
      <div className="space-y-2">
        <ResponsiveVideoFrame>
          <VideoUnavailableState onRetry={unplayable ? undefined : handleRetry} />
        </ResponsiveVideoFrame>
        {attribution}
      </div>
    );
  }

  if (isYouTube && videoId) {
    return (
      <div className="space-y-2">
        <ResponsiveVideoFrame>
          {!ready && <VideoLoadingState />}
          <YouTubeEmbed
            key={`${videoId}-${retryKey}`}
            videoId={videoId}
            onReady={handleYouTubeReady}
            onStateChange={handleYouTubeStateChange}
            onError={handleYouTubeError}
          />
        </ResponsiveVideoFrame>
        {attribution}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
        <audio
          ref={audioRef}
          src={content.mediaUrl}
          controls
          preload="metadata"
          onLoadedMetadata={handleAudioReady}
          onPlay={() => callbacksRef.current.onPlayingChange(true)}
          onPause={() => callbacksRef.current.onPlayingChange(false)}
          onEnded={() => callbacksRef.current.onPlayingChange(false)}
          onError={() => setFailed(true)}
          className="w-full"
        >
          {t.practice.listeningAudioUnsupported}
        </audio>
      </div>
      {attribution}
    </div>
  );
};

export default ListeningMediaPanel;
