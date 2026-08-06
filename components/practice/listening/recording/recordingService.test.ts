import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  classifyMicrophoneError,
  createSpeechRecognition,
  detectRecordingSupport,
  requestMicrophoneStream,
  stopStream,
  unsupportedReason,
} from './recordingService';
import {
  installRecordingMocks,
  restoreRecordingMocks,
  FakeSpeechRecognition,
  createFakeStream,
} from './testDoubles';

afterEach(() => {
  restoreRecordingMocks();
  vi.restoreAllMocks();
});

describe('classifyMicrophoneError', () => {
  // These are the exact DOMException names each browser throws. They are the
  // strings the UI branches on, which is why they are pinned by a test rather
  // than read off a page of documentation once.
  it.each([
    ['NotAllowedError', 'PERMISSION_DENIED'],
    ['PermissionDeniedError', 'PERMISSION_DENIED'],
    ['NotFoundError', 'DEVICE_NOT_FOUND'],
    ['DevicesNotFoundError', 'DEVICE_NOT_FOUND'],
    ['OverconstrainedError', 'DEVICE_CONSTRAINT_UNMET'],
    ['ConstraintNotSatisfiedError', 'DEVICE_CONSTRAINT_UNMET'],
    ['NotReadableError', 'DEVICE_BUSY'],
    ['TrackStartError', 'DEVICE_BUSY'],
    ['AbortError', 'DEVICE_ABORTED'],
    ['SecurityError', 'INSECURE_CONTEXT'],
  ])('maps %s to %s', (name, expected) => {
    expect(classifyMicrophoneError(new DOMException('x', name))).toBe(expected);
  });

  // Not merged with any of the named cases above: an unrecognised failure gets
  // its own copy, so the student is never told to change a permission that was
  // never the problem.
  it('classifies an unrecognised failure as a recorder failure, not a permission one', () => {
    expect(classifyMicrophoneError(new Error('boom'))).toBe('RECORDER_FAILED');
    expect(classifyMicrophoneError(null)).toBe('RECORDER_FAILED');
    expect(classifyMicrophoneError(undefined)).toBe('RECORDER_FAILED');
  });
});

describe('detectRecordingSupport', () => {
  it('reports full support when every API is present', () => {
    installRecordingMocks();

    expect(detectRecordingSupport()).toMatchObject({
      getUserMedia: true,
      mediaRecorder: true,
      speechRecognition: true,
      canRecord: true,
    });
  });

  // Firefox. Recording is the Phase 3 deliverable and it must not be disabled
  // because the transcript bonus is missing.
  it('still allows recording when the Web Speech API is absent', () => {
    installRecordingMocks({ withoutSpeechRecognition: true });

    const support = detectRecordingSupport();

    expect(support.speechRecognition).toBe(false);
    expect(support.canRecord).toBe(true);
  });

  it('refuses recording when MediaRecorder is absent', () => {
    installRecordingMocks({ withoutMediaRecorder: true });

    expect(detectRecordingSupport().canRecord).toBe(false);
  });

  it('accepts the webkit-prefixed recogniser', () => {
    installRecordingMocks({ withoutSpeechRecognition: true });
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
      FakeSpeechRecognition;

    expect(detectRecordingSupport().speechRecognition).toBe(true);
  });
});

describe('unsupportedReason', () => {
  // "Your browser is too old" and "this page is not on https" send a student to
  // fix two different things, and only one of them is the real problem.
  it('blames the connection, not the browser, outside a secure context', () => {
    expect(
      unsupportedReason({
        secureContext: false,
        getUserMedia: false,
        mediaRecorder: false,
        speechRecognition: false,
        deviceSelection: false,
        canRecord: false,
      }),
    ).toBe('INSECURE_CONTEXT');
  });

  it('blames the browser on https', () => {
    expect(
      unsupportedReason({
        secureContext: true,
        getUserMedia: false,
        mediaRecorder: false,
        speechRecognition: false,
        deviceSelection: false,
        canRecord: false,
      }),
    ).toBe('UNSUPPORTED');
  });
});

describe('requestMicrophoneStream', () => {
  it('asks for echo cancellation, because the video may be audible in the room', async () => {
    const mocks = installRecordingMocks();

    await requestMicrophoneStream();

    expect(mocks.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  });

  // `exact`, not `ideal`. An `ideal` deviceId permits the browser to substitute
  // a different microphone, which is exactly the Phase 3.1 failure: the student
  // picks Realtek, is quietly handed the virtual device again, and has no way
  // to tell. The same audio processing is requested on both paths.
  it('pins an exact device when one is chosen, with the same processing as the default path', async () => {
    const mocks = installRecordingMocks();

    await requestMicrophoneStream('device-7');

    expect(mocks.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'device-7' },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it('rejects with SecurityError when mediaDevices does not exist at all', async () => {
    restoreRecordingMocks();

    await expect(requestMicrophoneStream()).rejects.toMatchObject({
      name: 'SecurityError',
    });
  });
});

describe('stopStream', () => {
  // A live track keeps the OS microphone indicator lit, which reads as the app
  // still listening — the most alarming thing a mic feature can get wrong.
  it('stops every track and detaches its ended handler', () => {
    const { stream, track } = createFakeStream();
    track.onended = () => undefined;

    stopStream(stream);

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(track.onended).toBeNull();
  });

  it('tolerates a missing stream', () => {
    expect(() => stopStream(null)).not.toThrow();
  });
});

describe('createSpeechRecognition', () => {
  it('configures a continuous recogniser with interim results', () => {
    installRecordingMocks();

    const recognition = createSpeechRecognition('en-US');

    expect(recognition).not.toBeNull();
    expect(recognition?.lang).toBe('en-US');
    expect(recognition?.continuous).toBe(true);
    expect(recognition?.interimResults).toBe(true);
    // One alternative: Phase 3 shows raw text and compares nothing, so ranked
    // alternatives would be data with no reader.
    expect(recognition?.maxAlternatives).toBe(1);
  });

  it('returns null rather than throwing where the API does not exist', () => {
    installRecordingMocks({ withoutSpeechRecognition: true });

    expect(createSpeechRecognition('en-US')).toBeNull();
  });
});
