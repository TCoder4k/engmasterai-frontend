import React, { useCallback, useEffect, useRef, useState } from 'react';
import ResponsiveVideoFrame from './ResponsiveVideoFrame';
import YouTubeEmbed from './YouTubeEmbed';
import VideoLoadingState from './VideoLoadingState';
import VideoUnavailableState from './VideoUnavailableState';
import VideoResumePrompt from './VideoResumePrompt';
import { parseYouTubeVideoId } from './youtubeUrlParser';
import { authService } from '../../../services/authService';
import { getVideoProgress, saveVideoProgress } from '../../../services/videoProgress';

// YT.PlayerState values (stable, documented by the IFrame Player API) —
// not depending on the global YT type existing at module-eval time.
const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 };

const SAVE_INTERVAL_MS = 7000;
const NEAR_END_RATIO = 0.97;
const NEAR_END_MARGIN_SECONDS = 5;

interface LessonVideoPlayerProps {
  courseId: string;
  lessonId: string;
  resolvedLessonPath: string;
  videoUrl: string | null;
  // Sprint 06 — hands the live YT instance to the caller so lesson chrome
  // (e.g. the playback-speed controls) can drive it without this component
  // growing UI of its own. Called with null when the video is unavailable.
  onPlayerReady?: (player: any | null) => void;
  // Fires when the video reaches its end, so the page can advance the stage
  // flow. Progress persistence still happens here regardless.
  onEnded?: () => void;
}

// YouTube-based lesson video player (design doc §7.4). Composes the
// responsive frame, the embed itself, and every honest loading/failure
// state; owns the resume-position side effect (§7.4.3) — the one
// genuinely stateful component in the video stack, kept separate from the
// thinner presentational pieces around it so business logic isn't spread
// across all of them.
const LessonVideoPlayer: React.FC<LessonVideoPlayerProps> = ({
  courseId,
  lessonId,
  resolvedLessonPath,
  videoUrl,
  onPlayerReady,
  onEnded,
}) => {
  const videoId = parseYouTubeVideoId(videoUrl);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    videoId ? 'loading' : 'unavailable',
  );
  const [retryKey, setRetryKey] = useState(0);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  const playerInstanceRef = useRef<any>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pendingResumeRef = useRef<number | null>(null);

  // Held in refs so the YT callbacks below can stay identity-stable (they
  // are registered once with the embed) while still calling the latest
  // props. Passing the callbacks directly would re-register the handlers on
  // every parent render.
  const onPlayerReadyRef = useRef(onPlayerReady);
  const onEndedRef = useRef(onEnded);
  onPlayerReadyRef.current = onPlayerReady;
  onEndedRef.current = onEnded;

  const user = authService.getUser();
  const userId = user?.id;

  // Read any saved position once per lesson mount, before the player
  // exists, so onReady can decide whether to seek or offer a "watch
  // again?" prompt. Discarded if the saved youtubeVideoId doesn't match
  // the id parsed from the *current* videoUrl (design doc §7.4.3's
  // staleness rule — an admin replacing the lesson's video must not seek
  // a returning student into unrelated content).
  useEffect(() => {
    if (!videoId || !userId) {
      pendingResumeRef.current = null;
      return;
    }
    const saved = getVideoProgress(userId, lessonId);
    pendingResumeRef.current = saved && saved.youtubeVideoId === videoId ? saved.positionSeconds : null;
  }, [lessonId, videoId, userId]);

  const stopSaveTimer = () => {
    if (saveTimerRef.current !== null) {
      window.clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };

  const persistProgress = useCallback(
    (ended: boolean) => {
      const player = playerInstanceRef.current;
      if (!player || !videoId || !userId) return;
      const positionSeconds = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      const durationSeconds = typeof player.getDuration === 'function' ? player.getDuration() : 0;
      saveVideoProgress(userId, lessonId, {
        courseId,
        resolvedLessonPath,
        youtubeVideoId: videoId,
        positionSeconds,
        durationSeconds,
        lastUpdatedAt: new Date().toISOString(),
        ended,
      });
    },
    [courseId, lessonId, resolvedLessonPath, videoId, userId],
  );

  const handleReady = useCallback((player: any) => {
    playerInstanceRef.current = player;
    setStatus('ready');
    onPlayerReadyRef.current?.(player);

    const saved = pendingResumeRef.current;
    if (saved && saved > 0) {
      const duration = typeof player.getDuration === 'function' ? player.getDuration() : 0;
      // Duration may briefly be 0/unavailable right at onReady — treat that
      // as "unknown" and just resume without the near-end check rather
      // than blocking the resume on metadata that hasn't loaded yet.
      const nearEnd = duration > 0 && saved >= duration * NEAR_END_RATIO - NEAR_END_MARGIN_SECONDS;
      if (nearEnd) {
        setShowResumePrompt(true);
      } else {
        player.seekTo?.(saved, true);
      }
    }
  }, []);

  const handleStateChange = useCallback(
    (state: number) => {
      if (state === PLAYER_STATE.PLAYING) {
        stopSaveTimer();
        saveTimerRef.current = window.setInterval(() => persistProgress(false), SAVE_INTERVAL_MS);
      } else if (state === PLAYER_STATE.PAUSED) {
        stopSaveTimer();
        persistProgress(false);
      } else if (state === PLAYER_STATE.ENDED) {
        stopSaveTimer();
        persistProgress(true);
        // Persisted first, so a listener that re-reads progress sees the
        // completed state rather than racing it.
        onEndedRef.current?.();
      }
    },
    [persistProgress],
  );

  const handleError = useCallback(() => {
    stopSaveTimer();
    setStatus('unavailable');
    onPlayerReadyRef.current?.(null);
  }, []);

  // Always-save on tab close / route change, plus final cleanup on unmount
  // — a student navigating away mid-video doesn't lose their place.
  useEffect(() => {
    const onBeforeUnload = () => persistProgress(false);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      stopSaveTimer();
      persistProgress(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistProgress]);

  return (
    <ResponsiveVideoFrame>
      {status === 'loading' && <VideoLoadingState />}

      {status === 'unavailable' && (
        <VideoUnavailableState
          onRetry={
            videoId
              ? () => {
                  setStatus('loading');
                  setRetryKey((key) => key + 1);
                }
              : undefined
          }
        />
      )}

      {videoId && status !== 'unavailable' && (
        <YouTubeEmbed
          key={retryKey}
          videoId={videoId}
          onReady={handleReady}
          onStateChange={handleStateChange}
          onError={handleError}
        />
      )}

      {showResumePrompt && (
        <VideoResumePrompt
          onWatchAgain={() => {
            playerInstanceRef.current?.seekTo?.(0, true);
            setShowResumePrompt(false);
          }}
          onDismiss={() => setShowResumePrompt(false)}
        />
      )}
    </ResponsiveVideoFrame>
  );
};

export default LessonVideoPlayer;
