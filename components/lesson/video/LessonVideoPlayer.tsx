import React, { useCallback, useEffect, useRef, useState } from 'react';
import ResponsiveVideoFrame from './ResponsiveVideoFrame';
import YouTubeEmbed from './YouTubeEmbed';
import VideoLoadingState from './VideoLoadingState';
import VideoUnavailableState from './VideoUnavailableState';
import VideoResumePrompt from './VideoResumePrompt';
import { parseYouTubeVideoId } from './youtubeUrlParser';
import { authService } from '../../../services/authService';
import { recordVideoProgress } from '../../../services/progressService';
import { StepProgress } from '../../../services/lessonProgress';
import { useStudyActivity } from '../../shared/StudyTimeBoundary';

// YT.PlayerState values (stable, documented by the IFrame Player API) —
// not depending on the global YT type existing at module-eval time.
const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 };

const SAVE_INTERVAL_MS = 7000;
const NEAR_END_RATIO = 0.97;
const NEAR_END_MARGIN_SECONDS = 5;

// Sprint 07 — skip a scheduled save when the student has not actually moved.
// The interval fires on a timer, not on playback, so without this a paused or
// buffering tab still posts every 7 seconds. Forced flushes (pause, end,
// unload) ignore it.
const MIN_REPORT_DELTA_SECONDS = 5;

// How far the live video's length may differ from the one recorded on the
// student's first watch before the stored position is treated as belonging to
// a DIFFERENT video.
//
// This replaces the old youtubeVideoId equality check, which was exact but
// depended on a field only the localStorage record carried. Two different
// videos almost never share a runtime to within 5%, so an admin swapping a
// lesson's video still will not seek a returning student into unrelated
// content. Storing the video id server-side would restore exactness and is
// worth doing when something else needs a schema change here.
const DURATION_DRIFT_TOLERANCE = 0.05;

interface LessonVideoPlayerProps {
  lessonId: string;
  videoUrl: string | null;
  // Sprint 07 — the student's stored position, from the lesson-progress
  // request the page already makes. Previously read from localStorage by this
  // component; now passed in, so the player owns playback and not persistence
  // policy.
  savedProgress?: StepProgress | null;
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
  lessonId,
  videoUrl,
  savedProgress,
  onPlayerReady,
  onEnded,
}) => {
  const videoId = parseYouTubeVideoId(videoUrl);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    videoId ? 'loading' : 'unavailable',
  );
  const [retryKey, setRetryKey] = useState(0);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  // Sprint 10.5 — the ONLY idle bypass in the app. A student watching a video
  // for ten minutes touches nothing, and without this the study-time tracker
  // would stop crediting them after 60 seconds of "inactivity".
  const [isPlaying, setIsPlaying] = useState(false);

  // Registration only — no timer, no request. StudyTimeBoundary owns both.
  useStudyActivity({
    type: 'VIDEO',
    activityId: lessonId,
    active: true,
    mediaPlaying: isPlaying,
  });

  const playerInstanceRef = useRef<any>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pendingResumeRef = useRef<number | null>(null);
  // The last position actually sent, so an idle timer tick can be skipped.
  const lastSentPositionRef = useRef<number | null>(null);

  // Held in refs so the YT callbacks below can stay identity-stable (they
  // are registered once with the embed) while still calling the latest
  // props. Passing the callbacks directly would re-register the handlers on
  // every parent render.
  const onPlayerReadyRef = useRef(onPlayerReady);
  const onEndedRef = useRef(onEnded);
  const savedProgressRef = useRef(savedProgress);
  onPlayerReadyRef.current = onPlayerReady;
  onEndedRef.current = onEnded;
  savedProgressRef.current = savedProgress;

  const user = authService.getUser();
  const userId = user?.id;

  // The student's stored position, staged before the player exists so
  // onReady can decide whether to seek or offer a "watch again?" prompt.
  // Staleness is checked against the recorded duration in handleReady, where
  // the live duration is finally known.
  useEffect(() => {
    if (!videoId || !userId) {
      pendingResumeRef.current = null;
      return;
    }
    pendingResumeRef.current = savedProgress?.highestPositionSeconds ?? null;
    lastSentPositionRef.current = null;
  }, [lessonId, videoId, userId, savedProgress]);

  const stopSaveTimer = () => {
    if (saveTimerRef.current !== null) {
      window.clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };

  // Sprint 07 — posts to the server instead of writing localStorage.
  //
  // Deliberately fire-and-forget: a dropped heartbeat costs a few seconds of
  // resume accuracy and must never surface an error over a video the student
  // is watching. Completion is NOT decided here — the server applies the 90%
  // rule and the page re-reads it.
  const persistProgress = useCallback(
    async (
      options: { force?: boolean; keepalive?: boolean } = {},
    ): Promise<void> => {
      const player = playerInstanceRef.current;
      if (!player || !videoId || !userId) return;
      const positionSeconds =
        typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      const durationSeconds =
        typeof player.getDuration === 'function' ? player.getDuration() : 0;
      if (durationSeconds <= 0) return;

      // A timer tick with no real movement (paused, buffering, backgrounded
      // tab) is not worth a write.
      const last = lastSentPositionRef.current;
      if (
        !options.force &&
        last !== null &&
        Math.abs(positionSeconds - last) < MIN_REPORT_DELTA_SECONDS
      ) {
        return;
      }
      lastSentPositionRef.current = positionSeconds;

      try {
        await recordVideoProgress(lessonId, positionSeconds, durationSeconds, {
          keepalive: options.keepalive,
        });
      } catch {
        // Swallowed on purpose: a dropped heartbeat costs a few seconds of
        // resume accuracy and must never surface an error over a video the
        // student is watching. Rewound so the next tick retries this position
        // instead of treating it as already reported.
        lastSentPositionRef.current = last;
      }
    },
    [lessonId, videoId, userId],
  );

  const handleReady = useCallback((player: any) => {
    playerInstanceRef.current = player;
    setStatus('ready');
    onPlayerReadyRef.current?.(player);

    const saved = pendingResumeRef.current;
    if (saved && saved > 0) {
      const duration = typeof player.getDuration === 'function' ? player.getDuration() : 0;

      // Sprint 07 — staleness rule (design doc §7.4.3). If the runtime the
      // position was recorded against differs materially from what is playing
      // now, an admin has replaced the lesson's video and seeking would drop
      // the student into unrelated content.
      const recordedDuration = savedProgressRef.current?.videoDurationSeconds ?? null;
      const swapped =
        duration > 0 &&
        recordedDuration != null &&
        recordedDuration > 0 &&
        Math.abs(duration - recordedDuration) / recordedDuration >
          DURATION_DRIFT_TOLERANCE;
      if (swapped) return;

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
      setIsPlaying(state === PLAYER_STATE.PLAYING);
      if (state === PLAYER_STATE.PLAYING) {
        stopSaveTimer();
        saveTimerRef.current = window.setInterval(
          () => persistProgress(),
          SAVE_INTERVAL_MS,
        );
      } else if (state === PLAYER_STATE.PAUSED) {
        stopSaveTimer();
        persistProgress({ force: true });
      } else if (state === PLAYER_STATE.ENDED) {
        stopSaveTimer();
        // Awaited, unlike every other flush: the page re-reads progress in
        // onEnded, and firing that before the server has recorded the final
        // position would race the write and show the stage still unfinished.
        void persistProgress({ force: true }).finally(() => {
          onEndedRef.current?.();
        });
      }
    },
    [persistProgress],
  );

  const handleError = useCallback(() => {
    setIsPlaying(false);
    stopSaveTimer();
    setStatus('unavailable');
    onPlayerReadyRef.current?.(null);
  }, []);

  // Always-save on tab close / route change, plus final cleanup on unmount
  // — a student navigating away mid-video doesn't lose their place.
  useEffect(() => {
    // keepalive on this path only: an ordinary fetch is cancelled when the
    // document goes away, so without it the last position is lost exactly
    // when a student closes the tab mid-video.
    const onBeforeUnload = () => {
      void persistProgress({ force: true, keepalive: true });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      stopSaveTimer();
      void persistProgress({ force: true });
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
