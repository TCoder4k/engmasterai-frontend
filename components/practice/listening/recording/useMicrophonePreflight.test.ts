import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMicrophonePreflight,
  PREFLIGHT_DURATION_MS,
} from './useMicrophonePreflight';
import {
  installRecordingMocks,
  restoreRecordingMocks,
  FakeAudioContext,
  RecordingMocks,
} from './testDoubles';

// Sprint 11 Phase 3.1 — proving the microphone can be heard, before the student
// reads a sentence into it.
//
// The check runs on the SAME path the recorder will use: same constraints, same
// exact deviceId, an AnalyserNode on the stream that call returns. A preflight
// that proved a different stream worked would prove nothing about the recording.

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

let mocks: RecordingMocks;

beforeEach(() => {
  mocks = installRecordingMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  restoreRecordingMocks();
  vi.restoreAllMocks();
});

const runCheck = async (
  result: { current: ReturnType<typeof useMicrophonePreflight> },
) => {
  await act(async () => {
    result.current.start();
    await flush();
  });
  await act(async () => {
    vi.advanceTimersByTime(PREFLIGHT_DURATION_MS + 50);
    await flush();
  });
};

describe('useMicrophonePreflight', () => {
  it('starts idle and opens nothing', () => {
    const { result } = renderHook(() => useMicrophonePreflight('realtek-1'));

    expect(result.current.state).toBe('IDLE');
    expect(mocks.getUserMedia).not.toHaveBeenCalled();
  });

  it('checks the exact device it was given', async () => {
    const { result } = renderHook(() => useMicrophonePreflight('realtek-1'));

    await act(async () => {
      result.current.start();
      await flush();
    });

    expect(result.current.state).toBe('CHECKING');
    expect(mocks.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: 'realtek-1' } }),
    });
  });

  it('reports a signal when the microphone delivers audio', async () => {
    const { result } = renderHook(() => useMicrophonePreflight('realtek-1'));

    await runCheck(result);

    expect(result.current.state).toBe('SIGNAL_DETECTED');
    expect(result.current.peak).toBeGreaterThan(0);
  });

  // THE VIRTUAL AUDIO DEVICE. It opens cleanly, reports a live track and
  // produces perfect silence — every signal except the samples says it works.
  it('reports no signal when every sample is silence', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    const { result } = renderHook(() => useMicrophonePreflight('default'));

    await runCheck(result);

    expect(result.current.state).toBe('NO_SIGNAL');
    expect(result.current.peak).toBe(0);
  });

  it('releases the device and the audio context as soon as it has an answer', async () => {
    const { result } = renderHook(() => useMicrophonePreflight('realtek-1'));

    await runCheck(result);

    expect(mocks.track.stop).toHaveBeenCalled();
    expect(FakeAudioContext.latest().closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('surfaces a device that will not open, with its own kind', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ denyWith: 'OverconstrainedError' });
    const { result } = renderHook(() => useMicrophonePreflight('usb-gone'));

    await act(async () => {
      result.current.start();
      await flush();
    });

    expect(result.current.state).toBe('DEVICE_ERROR');
    expect(result.current.errorKind).toBe('DEVICE_CONSTRAINT_UNMET');
  });

  // A verdict belongs to the device it was measured on. Carrying it across to
  // a newly chosen microphone would let a student record on something that was
  // never checked, which is the original failure one step removed.
  it('discards its verdict when the student picks a different microphone', async () => {
    const { result, rerender } = renderHook(
      ({ deviceId }) => useMicrophonePreflight(deviceId),
      { initialProps: { deviceId: 'realtek-1' } },
    );
    await runCheck(result);
    expect(result.current.state).toBe('SIGNAL_DETECTED');

    rerender({ deviceId: 'usb-new' });

    expect(result.current.state).toBe('IDLE');
  });

  // UNMEASURED IS NOT A VERDICT. Reporting NO_SIGNAL here would lock a student
  // with a working microphone out of recording entirely, on the strength of a
  // measurement that never happened.
  it('reports that it cannot measure, rather than reporting silence, without WebAudio', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutAudioContext: true });
    const { result } = renderHook(() => useMicrophonePreflight('realtek-1'));

    await runCheck(result);

    expect(result.current.measurable).toBe(false);
    expect(result.current.state).toBe('IDLE');
    // And it must not leave the microphone open on the way out.
    expect(mocks.track.stop).toHaveBeenCalled();
  });

  it('cleans up when unmounted mid-check', async () => {
    const { result, unmount } = renderHook(() => useMicrophonePreflight('realtek-1'));
    await act(async () => {
      result.current.start();
      await flush();
    });

    unmount();

    expect(mocks.track.stop).toHaveBeenCalled();
    expect(FakeAudioContext.latest().closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('opens exactly one stream per check, even when run repeatedly', async () => {
    const { result } = renderHook(() => useMicrophonePreflight('realtek-1'));

    await runCheck(result);
    await runCheck(result);

    expect(mocks.getUserMedia).toHaveBeenCalledTimes(2);
    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
  });
});
