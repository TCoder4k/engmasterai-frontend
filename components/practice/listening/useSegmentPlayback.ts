import { useCallback, useEffect, useRef, useState } from 'react';

// Sprint 11 Phase 2 — play exactly one sentence of a recording and stop.
//
// PROVIDER-AGNOSTIC ON PURPOSE. The hook never mentions YouTube or <audio>; it
// drives a `MediaController`, and each provider supplies an adapter. That is
// what lets the same tested stop-at-end logic serve a YouTube iframe and an
// HTMLAudioElement, and it is why this file is unit-testable at all — a fake
// controller is four one-line methods.
//
// WHY POLLING. Neither provider can say "call me at 12.480s". The YouTube
// IFrame API exposes no end-timestamp callback, and HTMLMediaElement's
// `timeupdate` fires at a rate the browser chooses (typically 4/s, i.e. WORSE
// than the interval below). So the segment boundary is enforced by sampling
// `getCurrentTime()`, and overshoot is bounded by the sampling interval.
//
// THE INTERVAL IS A CHOICE, NOT A MEASUREMENT. The approved plan said to take
// this value from Phase 0's browser-feasibility measurements — but Phase 0 was
// gating Phase 3/4B (recording and speech), and it has never been run. 100ms
// is therefore picked for headroom rather than derived: it bounds overshoot at
// ~0.1s, which is under the threshold where a listener perceives a late stop
// as a mistake, while costing ten cheap property reads a second. Manual QA
// must record the OBSERVED overshoot; if it exceeds this bound the cause is
// the provider's own time resolution, not this number.
export const SEGMENT_POLL_INTERVAL_MS = 100;

/**
 * The minimum a media provider must offer to support segment practice.
 *
 * Times are in SECONDS here because that is the unit both providers actually
 * speak (`YT.Player.seekTo`, `HTMLMediaElement.currentTime`). Segments are
 * stored in integer milliseconds; the conversion happens at this boundary and
 * nowhere else.
 */
export interface MediaController {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getCurrentTime(): number;
  setPlaybackRate(rate: number): void;
  /** Real provider capability — never a hardcoded list of speeds. */
  getAvailablePlaybackRates(): number[];
}

export interface PlayableSegment {
  startTimeMs: number;
  endTimeMs: number;
}

interface UseSegmentPlaybackOptions {
  /** Null until the provider is ready; every action is a safe no-op before then. */
  controller: MediaController | null;
  /** Null when the recording has no sentences. */
  segment: PlayableSegment | null;
  loop: boolean;
  /** Fired when a segment reaches its end WITHOUT looping. */
  onSegmentEnd?: () => void;
}

export interface SegmentPlaybackApi {
  isPlaying: boolean;
  /** Seek to the sentence start and play. Always user-initiated. */
  playSegment: () => void;
  /** Identical to playSegment — named for the control the student actually presses. */
  replaySegment: () => void;
  pause: () => void;
}

export const useSegmentPlayback = ({
  controller,
  segment,
  loop,
  onSegmentEnd,
}: UseSegmentPlaybackOptions): SegmentPlaybackApi => {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read inside the interval tick, so toggling loop or switching sentences
  // mid-playback takes effect on the NEXT sample instead of being frozen into
  // the closure that started the timer.
  const segmentRef = useRef(segment);
  segmentRef.current = segment;
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const onSegmentEndRef = useRef(onSegmentEnd);
  onSegmentEndRef.current = onSegmentEnd;
  const controllerRef = useRef(controller);
  controllerRef.current = controller;

  // The ONLY place an interval is cleared, so "is there a timer running?" has
  // exactly one answer. Every path that stops playback routes through here —
  // that is what makes the no-duplicate-timer guarantee checkable rather than
  // a matter of reviewing each call site.
  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    stopPolling();
    controllerRef.current?.pause();
    setIsPlaying(false);
  }, [stopPolling]);

  const playSegment = useCallback(() => {
    const activeController = controllerRef.current;
    const activeSegment = segmentRef.current;
    if (!activeController || !activeSegment) return;

    // Clear first: pressing play twice must not leave two timers sampling the
    // same player.
    stopPolling();

    activeController.seekTo(activeSegment.startTimeMs / 1000);
    activeController.play();
    setIsPlaying(true);

    intervalRef.current = setInterval(() => {
      const tickController = controllerRef.current;
      const tickSegment = segmentRef.current;
      if (!tickController || !tickSegment) return;

      const currentMs = tickController.getCurrentTime() * 1000;
      if (currentMs < tickSegment.endTimeMs) return;

      if (loopRef.current) {
        // Seek back and keep both the timer and playback running — a loop is
        // one continuous play, not a stop followed by a start.
        tickController.seekTo(tickSegment.startTimeMs / 1000);
        return;
      }

      stopPolling();
      tickController.pause();
      setIsPlaying(false);
      onSegmentEndRef.current?.();
    }, SEGMENT_POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Selecting a different sentence stops playback and NEVER starts it again.
  // Autoplay-on-select would both violate the locked user-gesture rule and, on
  // iOS Safari, simply fail — a play() not traceable to a gesture is refused.
  const startTimeMs = segment?.startTimeMs ?? null;
  const endTimeMs = segment?.endTimeMs ?? null;
  useEffect(() => {
    stopPolling();
    setIsPlaying(false);
  }, [startTimeMs, endTimeMs, stopPolling]);

  // Unmount: stop the timer AND the audio. Clearing only the interval would
  // leave a YouTube iframe playing under the next page.
  useEffect(
    () => () => {
      stopPolling();
      controllerRef.current?.pause();
    },
    [stopPolling],
  );

  return { isPlaying, playSegment, replaySegment: playSegment, pause };
};
