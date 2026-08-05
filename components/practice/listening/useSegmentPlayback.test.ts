import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSegmentPlayback,
  SEGMENT_POLL_INTERVAL_MS,
  MediaController,
} from './useSegmentPlayback';

// A fake provider. Time only moves when a test moves it, so "stops at the end
// of the sentence" is asserted against an exact clock rather than a real
// player's timing.
const createFakeController = () => {
  let currentTime = 0;
  const controller: MediaController & { setCurrentTime: (s: number) => void } = {
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn((seconds: number) => {
      currentTime = seconds;
    }),
    getCurrentTime: () => currentTime,
    setPlaybackRate: vi.fn(),
    getAvailablePlaybackRates: () => [0.5, 1, 1.5, 2],
    setCurrentTime: (seconds: number) => {
      currentTime = seconds;
    },
  };
  return controller;
};

// 4.0s -> 9.5s
const SEGMENT = { startTimeMs: 4000, endTimeMs: 9500 };

const countActiveIntervals = () => vi.getTimerCount();

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSegmentPlayback', () => {
  it('does not play when a segment is merely selected — playback needs a user gesture', () => {
    const controller = createFakeController();

    const { rerender } = renderHook(
      ({ segment }) =>
        useSegmentPlayback({ controller, segment, loop: false }),
      { initialProps: { segment: SEGMENT } },
    );

    rerender({ segment: { startTimeMs: 12000, endTimeMs: 15000 } });

    expect(controller.play).not.toHaveBeenCalled();
    expect(countActiveIntervals()).toBe(0);
  });

  it('seeks to the segment start before playing', () => {
    const controller = createFakeController();
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller, segment: SEGMENT, loop: false }),
    );

    act(() => result.current.playSegment());

    expect(controller.seekTo).toHaveBeenCalledWith(4);
    expect(controller.play).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(true);
  });

  it('keeps playing before the end and pauses exactly once past it', () => {
    const controller = createFakeController();
    const onSegmentEnd = vi.fn();
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller, segment: SEGMENT, loop: false, onSegmentEnd }),
    );

    act(() => result.current.playSegment());

    // Still inside the sentence — must not stop.
    controller.setCurrentTime(9.4);
    act(() => void vi.advanceTimersByTime(SEGMENT_POLL_INTERVAL_MS));
    expect(controller.pause).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);

    // Past the end.
    controller.setCurrentTime(9.6);
    act(() => void vi.advanceTimersByTime(SEGMENT_POLL_INTERVAL_MS));
    expect(controller.pause).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
    expect(onSegmentEnd).toHaveBeenCalledTimes(1);

    // The timer is gone, so no further tick can pause a second time.
    act(() => void vi.advanceTimersByTime(SEGMENT_POLL_INTERVAL_MS * 20));
    expect(controller.pause).toHaveBeenCalledTimes(1);
    expect(countActiveIntervals()).toBe(0);
  });

  it('loops back to the start instead of pausing when loop is on', () => {
    const controller = createFakeController();
    const onSegmentEnd = vi.fn();
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller, segment: SEGMENT, loop: true, onSegmentEnd }),
    );

    act(() => result.current.playSegment());
    controller.setCurrentTime(9.6);
    act(() => void vi.advanceTimersByTime(SEGMENT_POLL_INTERVAL_MS));

    // Seek #1 was the initial one; #2 is the loop.
    expect(controller.seekTo).toHaveBeenCalledTimes(2);
    expect(controller.seekTo).toHaveBeenLastCalledWith(4);
    expect(controller.pause).not.toHaveBeenCalled();
    expect(onSegmentEnd).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it('reads the loop flag live, so turning loop off ends the sentence on the next pass', () => {
    const controller = createFakeController();
    const { result, rerender } = renderHook(
      ({ loop }) => useSegmentPlayback({ controller, segment: SEGMENT, loop }),
      { initialProps: { loop: true } },
    );

    act(() => result.current.playSegment());
    rerender({ loop: false });

    controller.setCurrentTime(9.6);
    act(() => void vi.advanceTimersByTime(SEGMENT_POLL_INTERVAL_MS));

    expect(controller.pause).toHaveBeenCalledTimes(1);
  });

  it('never runs two timers, however often play is pressed', () => {
    const controller = createFakeController();
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller, segment: SEGMENT, loop: false }),
    );

    act(() => result.current.playSegment());
    act(() => result.current.playSegment());
    act(() => result.current.replaySegment());

    expect(countActiveIntervals()).toBe(1);
  });

  it('replay restarts the sentence from its beginning', () => {
    const controller = createFakeController();
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller, segment: SEGMENT, loop: false }),
    );

    act(() => result.current.playSegment());
    controller.setCurrentTime(7);
    act(() => result.current.replaySegment());

    expect(controller.seekTo).toHaveBeenLastCalledWith(4);
    expect(controller.getCurrentTime()).toBe(4);
  });

  it('pause stops both the audio and the timer', () => {
    const controller = createFakeController();
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller, segment: SEGMENT, loop: false }),
    );

    act(() => result.current.playSegment());
    act(() => result.current.pause());

    expect(controller.pause).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
    expect(countActiveIntervals()).toBe(0);
  });

  it('switching sentence mid-playback clears the timer and stops', () => {
    const controller = createFakeController();
    const { result, rerender } = renderHook(
      ({ segment }) => useSegmentPlayback({ controller, segment, loop: false }),
      { initialProps: { segment: SEGMENT } },
    );

    act(() => result.current.playSegment());
    expect(countActiveIntervals()).toBe(1);

    rerender({ segment: { startTimeMs: 12000, endTimeMs: 15000 } });

    expect(countActiveIntervals()).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('unmount stops the media as well as the timer, so nothing plays under the next page', () => {
    const controller = createFakeController();
    const { result, unmount } = renderHook(() =>
      useSegmentPlayback({ controller, segment: SEGMENT, loop: false }),
    );

    act(() => result.current.playSegment());
    unmount();

    expect(countActiveIntervals()).toBe(0);
    expect(controller.pause).toHaveBeenCalledTimes(1);
  });

  it('is inert while the provider is still loading', () => {
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller: null, segment: SEGMENT, loop: false }),
    );

    act(() => result.current.playSegment());

    expect(result.current.isPlaying).toBe(false);
    expect(countActiveIntervals()).toBe(0);
  });

  it('is inert for a recording that has no sentences', () => {
    const controller = createFakeController();
    const { result } = renderHook(() =>
      useSegmentPlayback({ controller, segment: null, loop: false }),
    );

    act(() => result.current.playSegment());

    expect(controller.play).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
  });
});
