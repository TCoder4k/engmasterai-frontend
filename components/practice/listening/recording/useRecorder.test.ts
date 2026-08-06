import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useRecorder,
  MAX_RECORDING_MS,
  TRANSCRIBE_TIMEOUT_MS,
  RECORDER_TIMESLICE_MS,
} from './useRecorder';
import {
  installRecordingMocks,
  restoreRecordingMocks,
  FakeMediaRecorder,
  FakeSpeechRecognition,
  FakeAudioContext,
  RecordingMocks,
} from './testDoubles';

// The `await requestMicrophoneStream()` inside start() resolves over several
// microtask turns. Flushing a fixed handful is deterministic under fake timers,
// where waitFor's polling would need real ones.
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

let mocks: RecordingMocks;

const setup = (options?: Parameters<typeof useRecorder>[0]) =>
  renderHook(() => useRecorder(options));

// Transcription is OFF by default since browser QA found it silences Chrome's
// recording (SPEECH_RECOGNITION_WHILE_RECORDING). The path is not deleted, so
// it is not untested either: everything that exercises SpeechRecognition opts
// in explicitly here, which also makes each of those tests state at its call
// site that it is testing a non-default configuration.
const setupWithTranscript = (options?: Parameters<typeof useRecorder>[0]) =>
  renderHook(() => useRecorder({ ...options, transcribeWhileRecording: true }));

const startRecording = async (
  result: { current: ReturnType<typeof useRecorder> },
): Promise<void> => {
  await act(async () => {
    result.current.start();
    await flush();
  });
};

beforeEach(() => {
  mocks = installRecordingMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  restoreRecordingMocks();
  vi.restoreAllMocks();
});

describe('useRecorder — starting', () => {
  it('begins at IDLE with no error when the browser can record', () => {
    const { result } = setup();

    expect(result.current.state).toBe('IDLE');
    expect(result.current.errorKind).toBeNull();
  });

  it('opens the microphone and reaches RECORDING', async () => {
    const { result } = setup();

    await startRecording(result);

    expect(mocks.getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('RECORDING');
    expect(result.current.isRecording).toBe(true);
    expect(FakeMediaRecorder.latest().state).toBe('recording');
  });

  // Ordering, not politeness: the permission prompt is modal and blocks, so a
  // video paused after it would keep playing underneath the dialog.
  it('runs onBeforeStart before the permission prompt is raised', async () => {
    const calls: string[] = [];
    mocks.getUserMedia.mockImplementation(() => {
      calls.push('getUserMedia');
      return Promise.resolve(mocks.stream);
    });
    const { result } = setup({ onBeforeStart: () => calls.push('onBeforeStart') });

    await startRecording(result);

    expect(calls).toEqual(['onBeforeStart', 'getUserMedia']);
  });

  it('asks the browser which container it can record rather than assuming one', async () => {
    FakeMediaRecorder.supportedTypes = new Set(['audio/mp4;codecs=mp4a.40.2']);
    const { result } = setup();

    await startRecording(result);

    expect(FakeMediaRecorder.latest().mimeType).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  // Pressing Record twice must never leave two recorders on one device.
  it('tears the previous recorder down before starting a second one', async () => {
    const { result } = setup();

    await startRecording(result);
    const first = FakeMediaRecorder.latest();
    await startRecording(result);

    expect(FakeMediaRecorder.instances).toHaveLength(2);
    expect(first.state).toBe('inactive');
    expect(FakeMediaRecorder.latest().state).toBe('recording');
    expect(result.current.state).toBe('RECORDING');
  });
});

describe('useRecorder — stopping', () => {
  it('produces a blob and an object URL, and lands on RESULT', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(result.current.blob).not.toBeNull();
    expect(result.current.blob?.size).toBeGreaterThan(0);
    expect(result.current.blobUrl).toMatch(/^blob:/);
    expect(mocks.createObjectURL).toHaveBeenCalledTimes(1);
  });

  // Called from four places, none of which knows it is the last. A second
  // finalise would mint a second URL for the same blob.
  it('finalises exactly once even when every ending fires', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
      vi.advanceTimersByTime(TRANSCRIBE_TIMEOUT_MS + 100);
      await flush();
    });

    expect(mocks.createObjectURL).toHaveBeenCalledTimes(1);
  });

  // Stop is the START of the ending, not the ending. Recognition delivers its
  // final result after capture has ceased.
  it('waits in TRANSCRIBING while speech recognition is still outstanding', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);
    const recognition = FakeSpeechRecognition.latest();
    // A recogniser that ignores stop(), which Chrome sometimes does.
    recognition.stop = () => undefined;

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('TRANSCRIBING');

    await act(async () => {
      vi.advanceTimersByTime(TRANSCRIBE_TIMEOUT_MS);
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
  });

  // The blob is already good; sitting on "Finishing…" forever is worse than an
  // empty transcript.
  it('gives up on a recogniser that never ends, instead of hanging', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);
    FakeSpeechRecognition.latest().stop = () => undefined;

    await act(async () => {
      result.current.stop();
      await flush();
      vi.advanceTimersByTime(TRANSCRIBE_TIMEOUT_MS);
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(result.current.blobUrl).toMatch(/^blob:/);
  });

  // The title used to say "as soon as capture stops, not when the transcript
  // lands". That was the behaviour, and it was the Chrome bug: the tracks died
  // before the encoder had flushed. Release now happens in `finalize`, i.e.
  // once the blob is genuinely in hand — a lit microphone indicator for up to
  // the transcribe timeout is a far smaller cost than losing the recording.
  it('releases the microphone once the recording is genuinely in hand', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(mocks.track.stop).toHaveBeenCalled();
    expect(result.current.state).toBe('RESULT');
  });

  it('records how long the recording actually was', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await flush();
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.durationMs).toBeGreaterThanOrEqual(2_000);
  });

  // Zero bytes is not a recording. A silent player with no explanation lets the
  // student blame their microphone for our failure.
  it('reports a failure rather than offering an empty recording', async () => {
    FakeMediaRecorder.produceEmptyBlob = true;
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('ERROR');
    expect(result.current.errorKind).toBe('RECORDER_FAILED');
    expect(result.current.blobUrl).toBeNull();
  });
});

describe('useRecorder — elapsed time and the cap', () => {
  it('advances the elapsed counter while recording', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await flush();
    });

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(1_000);
  });

  it('stops itself at the cap so chunks cannot grow without bound', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(MAX_RECORDING_MS + 200);
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(FakeMediaRecorder.latest().state).toBe('inactive');
  });

  it('honours a shorter cap when one is given', async () => {
    const { result } = setup({ maxDurationMs: 2_000 });
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(2_200);
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
  });
});

describe('useRecorder — transcript', () => {
  it('shows interim words apart from settled ones', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);

    act(() => {
      FakeSpeechRecognition.latest().emitResult('the quick brown', false);
    });

    expect(result.current.interimTranscript).toBe('the quick brown');
    expect(result.current.transcript).toBe('');

    act(() => {
      FakeSpeechRecognition.latest().emitResult('the quick brown fox', true);
    });

    expect(result.current.transcript).toBe('the quick brown fox');
  });

  // Raw means raw. No trimming of punctuation, no case folding, no comparison
  // with the sentence — all of that is Phase 4B's, on the server.
  it('accumulates final results verbatim across the recording', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);

    act(() => {
      FakeSpeechRecognition.latest().emitResult('Hello there,', true);
    });
    act(() => {
      FakeSpeechRecognition.latest().emitResult('General Kenobi!', true);
    });

    expect(result.current.transcript).toBe('Hello there, General Kenobi!');
  });

  it('clears the interim guess when recognition ends', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);

    act(() => {
      FakeSpeechRecognition.latest().emitResult('half a sen', false);
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.interimTranscript).toBe('');
  });

  // Firefox. Audio is the deliverable; the transcript is the bonus.
  it('records normally when the browser has no speech recognition', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutSpeechRecognition: true });
    const { result } = setupWithTranscript();

    await startRecording(result);
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.support.speechRecognition).toBe(false);
    expect(result.current.state).toBe('RESULT');
    expect(result.current.blobUrl).toMatch(/^blob:/);
    expect(result.current.transcript).toBe('');
  });

  it('keeps the recording when recognition refuses to start', async () => {
    FakeSpeechRecognition.failOnStart = true;
    const { result } = setupWithTranscript();

    await startRecording(result);

    expect(result.current.state).toBe('RECORDING');
    expect(result.current.recognitionFailed).toBe(true);
  });

  // A student who did not speak is not a malfunction, and the recording of
  // their silence is still valid.
  it('does not flag no-speech as a recognition failure', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);

    act(() => {
      FakeSpeechRecognition.latest().emitError('no-speech');
    });

    expect(result.current.recognitionFailed).toBe(false);
    expect(result.current.state).toBe('RECORDING');
  });

  it('flags a real recognition error without ending the recording', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);

    act(() => {
      FakeSpeechRecognition.latest().emitError('network');
    });

    expect(result.current.recognitionFailed).toBe(true);
    expect(result.current.state).toBe('RECORDING');
  });
});

describe('useRecorder — error paths', () => {
  // Each of these gets its own kind because each has a different fix, and a
  // shared "unknown error" sends every student to the wrong one.
  it.each([
    ['NotAllowedError', 'PERMISSION_DENIED', 'PERMISSION_DENIED'],
    ['NotFoundError', 'DEVICE_NOT_FOUND', 'ERROR'],
    ['NotReadableError', 'DEVICE_BUSY', 'ERROR'],
    ['SecurityError', 'INSECURE_CONTEXT', 'ERROR'],
  ])('maps a %s rejection to %s', async (name, kind, state) => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ denyWith: name });
    const { result } = setup();

    await startRecording(result);

    expect(result.current.errorKind).toBe(kind);
    expect(result.current.state).toBe(state);
  });

  it('reports UNSUPPORTED from the first render when MediaRecorder is missing', () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutMediaRecorder: true });
    const { result } = setup();

    expect(result.current.state).toBe('UNSUPPORTED');
    expect(result.current.errorKind).toBe('UNSUPPORTED');
  });

  it('never opens the microphone on an unsupported browser', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutMediaRecorder: true });
    const { result } = setup();

    await startRecording(result);

    expect(mocks.getUserMedia).not.toHaveBeenCalled();
    expect(result.current.state).toBe('UNSUPPORTED');
  });

  // The one failure with no return value to inspect: the device simply goes.
  it('treats a track ending mid-recording as a revoked permission', async () => {
    const { result } = setup();
    await startRecording(result);

    act(() => {
      mocks.track.onended?.();
    });

    expect(result.current.state).toBe('ERROR');
    expect(result.current.errorKind).toBe('PERMISSION_REVOKED');
    expect(result.current.blobUrl).toBeNull();
  });

  // Our own teardown ends the track too. Reading that as revocation would show
  // a scary message every time a student pressed Stop.
  it('does not mistake its own teardown for a revocation', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(result.current.errorKind).toBeNull();
  });

  it('surfaces a MediaRecorder that cannot be constructed', async () => {
    const { result } = setup();
    FakeMediaRecorder.failOnConstruct = true;

    await startRecording(result);

    expect(result.current.state).toBe('ERROR');
    expect(result.current.errorKind).toBe('RECORDER_FAILED');
    expect(mocks.track.stop).toHaveBeenCalled();
  });

  it('surfaces a MediaRecorder error event', async () => {
    const { result } = setup();
    await startRecording(result);

    act(() => {
      FakeMediaRecorder.latest().emitError();
    });

    expect(result.current.state).toBe('ERROR');
    expect(result.current.errorKind).toBe('RECORDER_FAILED');
  });
});

describe('useRecorder — retry', () => {
  it('discards the recording, the transcript and the timer', async () => {
    const { result } = setupWithTranscript();
    await startRecording(result);
    act(() => {
      FakeSpeechRecognition.latest().emitResult('something', true);
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });
    const url = result.current.blobUrl;

    act(() => result.current.retry());

    expect(mocks.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(result.current.state).toBe('IDLE');
    expect(result.current.blob).toBeNull();
    expect(result.current.blobUrl).toBeNull();
    expect(result.current.transcript).toBe('');
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.durationMs).toBeNull();
    expect(result.current.errorKind).toBeNull();
  });

  it('cancels a recording that is still running', async () => {
    const { result } = setup();
    await startRecording(result);

    act(() => result.current.retry());

    expect(result.current.state).toBe('IDLE');
    expect(FakeMediaRecorder.latest().state).toBe('inactive');
    expect(mocks.track.stop).toHaveBeenCalled();
  });

  it('clears an error so the student can try again', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ denyWith: 'NotAllowedError' });
    const { result } = setup();
    await startRecording(result);
    expect(result.current.state).toBe('PERMISSION_DENIED');

    act(() => result.current.retry());

    expect(result.current.state).toBe('IDLE');
    expect(result.current.errorKind).toBeNull();
  });

  // Retry cannot install a MediaRecorder that the browser does not have.
  it('stays UNSUPPORTED on a browser that cannot record', () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutMediaRecorder: true });
    const { result } = setup();

    act(() => result.current.retry());

    expect(result.current.state).toBe('UNSUPPORTED');
    expect(result.current.errorKind).toBe('UNSUPPORTED');
  });

  it('records again cleanly after a retry', async () => {
    const { result } = setup();
    await startRecording(result);
    await act(async () => {
      result.current.stop();
      await flush();
    });
    act(() => result.current.retry());

    await startRecording(result);
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(mocks.createObjectURL).toHaveBeenCalledTimes(2);
    expect(mocks.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('useRecorder — cleanup', () => {
  // Navigating away mid-recording is an ordinary thing for a student to do.
  // None of the device, the timers or the object URL may survive it.
  it('releases the device and the timers on unmount while recording', async () => {
    const { result, unmount } = setup();
    await startRecording(result);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(mocks.track.stop).toHaveBeenCalled();
    expect(FakeMediaRecorder.latest().state).toBe('inactive');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('revokes the object URL on unmount', async () => {
    const { result, unmount } = setup();
    await startRecording(result);
    await act(async () => {
      result.current.stop();
      await flush();
    });
    const url = result.current.blobUrl;

    unmount();

    expect(mocks.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it('leaves no timer behind after a completed recording', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts recognition on unmount so a late result cannot arrive', async () => {
    const { result, unmount } = setupWithTranscript();
    await startRecording(result);
    const recognition = FakeSpeechRecognition.latest();

    unmount();

    expect(recognition.started).toBe(false);
    expect(recognition.onresult).toBeNull();
    expect(recognition.onend).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The Chrome bug browser QA found: a seven-second recording that produced a
// 110-byte WebM container header and no audio. Edge produced 131 KB from the
// same code, which is what made it a race rather than a codec problem.
// ---------------------------------------------------------------------------

describe('useRecorder — the microphone outlives the flush', () => {
  // The root cause. `recorder.stop()` is asynchronous, so stopping the tracks
  // in the same tick could cut the encoder off before it wrote its clusters.
  it('does NOT stop the microphone tracks before the blob has been flushed', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    // Asserted at the moment of the flush, not afterwards — the tracks are
    // still released, just later.
    expect(FakeMediaRecorder.tracksLiveAtFlush).toBe(true);
    expect(mocks.track.stop).toHaveBeenCalled();
  });

  it('still releases the microphone when the recorder never flushes', async () => {
    const { result } = setup();
    await startRecording(result);
    // An engine that acknowledges stop() and then goes quiet.
    FakeMediaRecorder.latest().stop = () => undefined;

    await act(async () => {
      result.current.stop();
      await flush();
      vi.advanceTimersByTime(TRANSCRIBE_TIMEOUT_MS);
      await flush();
    });

    // The timeout path must not leave the OS microphone indicator lit.
    expect(mocks.track.stop).toHaveBeenCalled();
  });

  // Without a timeslice the whole recording lives inside the encoder until
  // stop(), so anything that disturbs that flush loses all of it.
  it('asks for chunks during the recording, not only at the end', async () => {
    const { result } = setup();

    await startRecording(result);

    expect(FakeMediaRecorder.latest().timeslice).toBe(RECORDER_TIMESLICE_MS);
  });

  // 110 bytes is not zero bytes, which is exactly why the original
  // `size === 0` check let this through to a player showing 0:00.
  it('rejects a container header with no audio in it', async () => {
    FakeMediaRecorder.produceHeaderOnlyBlob = true;
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('ERROR');
    expect(result.current.errorKind).toBe('RECORDER_FAILED');
    expect(result.current.blobUrl).toBeNull();
  });

  it('accepts a recording that actually contains audio', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(result.current.blob!.size).toBeGreaterThan(512);
  });
});

// ---------------------------------------------------------------------------
// The Chrome bug, second finding. The first fix (timeslice + releasing the
// device only after the flush) turned a 110-byte file into a ~1 KB file, which
// was progress and was not a fix: the file was still container framing with no
// audio in it. The timer, the chunk callbacks and the resolved getUserMedia all
// agreed the recording was fine, because none of them looks at the samples.
//
// Cause: SpeechRecognition and MediaRecorder cannot share a microphone on
// Chrome. The Web Speech API accepts no MediaStream, so each opens the device
// separately, and the recorder's track comes back muted.
// ---------------------------------------------------------------------------

describe('useRecorder — the microphone is not shared with speech recognition', () => {
  it('does NOT start speech recognition during a recording by default', async () => {
    const { result } = setup();

    await startRecording(result);

    // The API is present and would have constructed — this is a choice, not a
    // capability check. `support.speechRecognition` stays true precisely so the
    // difference between "absent" and "declined" remains visible.
    expect(result.current.support.speechRecognition).toBe(true);
    expect(FakeSpeechRecognition.instances).toHaveLength(0);
  });

  it('still records, plays back and finishes with no recogniser involved', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await flush();
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(result.current.blob!.size).toBeGreaterThan(512);
    expect(result.current.blobUrl).toMatch(/^blob:/);
    expect(result.current.transcript).toBe('');
  });

  // With nothing to wait for, RESULT must arrive on the blob alone. Sitting in
  // TRANSCRIBING for the timeout when no transcript was ever requested would be
  // three seconds of "Finishing…" for nothing.
  it('reaches RESULT without waiting out the transcribe timeout', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('opts in per call, so Phase 4B can turn it back on without editing the hook', async () => {
    const { result } = setupWithTranscript();

    await startRecording(result);

    expect(FakeSpeechRecognition.instances).toHaveLength(1);
  });
});

describe('useRecorder — silent capture is measured, not assumed', () => {
  it('taps the recording stream through WebAudio rather than opening the device again', async () => {
    const { result } = setup();

    await startRecording(result);

    expect(result.current.hasLevelMeter).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
    // One and only one getUserMedia for the whole recording: the meter reads
    // the stream the recorder already owns. Opening a second capture on the
    // device is the mistake this entire bug came from.
    expect(mocks.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('reports the live input level while recording', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await flush();
    });

    expect(result.current.inputLevel).toBeGreaterThan(0);
  });

  // THE REGRESSION TEST FOR THE REPORTED BUG. Every other signal reports
  // success: the recorder ran, chunks arrived, the blob is a plausible size and
  // the timer counted to eight seconds. Only the samples disagree.
  it('rejects a recording whose samples are all silence', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(8_000);
      await flush();
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('ERROR');
    // Distinct from RECORDER_FAILED on purpose: nothing threw, and the fix is a
    // mute switch or an input device rather than "try again".
    expect(result.current.errorKind).toBe('SILENT_CAPTURE');
    expect(result.current.blobUrl).toBeNull();
  });

  it('does not mint an object URL for a recording it is about to reject', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(8_000);
      await flush();
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(mocks.createObjectURL).not.toHaveBeenCalled();
  });

  // A take stopped almost immediately can legitimately hold no signal, and
  // calling that a broken microphone sends the student to fix nothing.
  it('does not call a very short silent take a fault', async () => {
    FakeAudioContext.sampleAmplitude = 0;
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.state).toBe('RESULT');
  });

  // Unmeasured is not a verdict. On an engine with no WebAudio the recording
  // must be handed over exactly as before, not condemned on an absent signal.
  it('never reports silence on an engine that has no level meter', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutAudioContext: true });
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(8_000);
      await flush();
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(result.current.hasLevelMeter).toBe(false);
    expect(result.current.state).toBe('RESULT');
    expect(result.current.blobUrl).toMatch(/^blob:/);
  });

  it('records normally when WebAudio refuses the stream', async () => {
    FakeAudioContext.failOnConstruct = true;
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      vi.advanceTimersByTime(8_000);
      await flush();
    });
    await act(async () => {
      result.current.stop();
      await flush();
    });

    // The instrument watching the recording must never be able to take it down.
    expect(result.current.hasLevelMeter).toBe(false);
    expect(result.current.state).toBe('RESULT');
  });

  it('closes the audio context when the recording finishes', async () => {
    const { result } = setup();
    await startRecording(result);
    const context = FakeAudioContext.latest();

    await act(async () => {
      result.current.stop();
      await flush();
    });

    expect(context.closed).toBe(true);
    expect(context.sourceDisconnected).toBe(true);
  });

  it('closes the audio context on unmount mid-recording', async () => {
    const { result, unmount } = setup();
    await startRecording(result);
    const context = FakeAudioContext.latest();

    unmount();

    expect(context.closed).toBe(true);
  });

  it('opens exactly one audio context per recording across retries', async () => {
    const { result } = setup();
    await startRecording(result);

    await act(async () => {
      result.current.retry();
      await flush();
    });
    await startRecording(result);

    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(FakeAudioContext.instances[0].closed).toBe(true);
    expect(FakeAudioContext.instances[1].closed).toBe(false);
  });
});
