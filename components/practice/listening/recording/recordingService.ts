// Sprint 11 Phase 3 — the only module that touches the browser's capture APIs.
//
// EVERY CALL READS THE GLOBALS AT CALL TIME. Nothing here is captured at module
// load, which is what lets `useRecorder` be tested against installed fakes and
// what keeps the app from crashing on import in an engine that has none of
// these APIs.
//
// LOCAL-ONLY, BY STRUCTURE. There is no fetch, no apiFetch import and no URL in
// this file. Phase 3 records, plays back and discards; audio never leaves the
// browser, and the absence of a network call is the guarantee rather than a
// promise made in a comment elsewhere.
//
// SPEECH RECOGNITION IS TYPED HERE, NOT GLOBALLY. The Web Speech API is
// vendor-prefixed and absent from this project's TS lib, so the structural
// types below describe exactly the surface used. They are deliberately NOT
// `declare global` — widening the global namespace would let any file assume
// the API exists, which on Firefox it does not.

export type RecordingErrorKind =
  /** getUserMedia rejected with NotAllowedError — the student said no, or a policy did. */
  | 'PERMISSION_DENIED'
  /** The mic track ended while recording: permission withdrawn, or the device vanished. */
  | 'PERMISSION_REVOKED'
  /** NotFoundError — there is no audio input on this machine at all. */
  | 'DEVICE_NOT_FOUND'
  /**
   * OverconstrainedError — the SPECIFIC device that was asked for is gone.
   *
   * Split from DEVICE_NOT_FOUND in Phase 3.1 because the two now lead
   * somewhere different: "you have no microphone" is a hardware problem, while
   * "the one you picked has been unplugged" is fixed by picking another from a
   * list the app can show. Merging them sent the second case to the first
   * case's dead end.
   */
  | 'DEVICE_CONSTRAINT_UNMET'
  /** NotReadableError — the OS or another app holds the device. */
  | 'DEVICE_BUSY'
  /** AbortError — the device was taken away mid-request, e.g. unplugged during the prompt. */
  | 'DEVICE_ABORTED'
  /** No secure context, so `navigator.mediaDevices` does not exist at all. */
  | 'INSECURE_CONTEXT'
  /** The engine has no MediaRecorder / getUserMedia even on https. */
  | 'UNSUPPORTED'
  /** MediaRecorder itself failed, or produced no bytes. */
  | 'RECORDER_FAILED'
  /**
   * The recorder ran, the timer ran, and the microphone delivered pure digital
   * silence for the whole take.
   *
   * Distinct from RECORDER_FAILED because nothing failed in the sense of
   * throwing: getUserMedia resolved, the track was live, MediaRecorder emitted
   * chunks. The samples inside them were all zero. That is what a muted track
   * looks like from here, and the student's fix is different — mute switch,
   * wrong input device, or another tab holding the microphone.
   */
  | 'SILENT_CAPTURE'
  /** SpeechRecognition failed. NON-FATAL — the audio is still recorded. */
  | 'RECOGNITION_FAILED';

export interface RecordingSupport {
  secureContext: boolean;
  getUserMedia: boolean;
  mediaRecorder: boolean;
  /** Web Speech API. False on Firefox, and that must not disable recording. */
  speechRecognition: boolean;
  /** `enumerateDevices` exists, so a microphone chooser can be offered. */
  deviceSelection: boolean;
  /** Recording and playback are possible. Transcription is a separate question. */
  canRecord: boolean;
}

export const detectRecordingSupport = (): RecordingSupport => {
  if (typeof window === 'undefined') {
    return {
      secureContext: false,
      getUserMedia: false,
      mediaRecorder: false,
      speechRecognition: false,
      deviceSelection: false,
      canRecord: false,
    };
  }

  const w = window as unknown as Record<string, unknown>;
  const secureContext = window.isSecureContext !== false;
  const getUserMedia =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
  const mediaRecorder = typeof w.MediaRecorder === 'function';
  const speechRecognition =
    typeof w.SpeechRecognition === 'function' ||
    typeof w.webkitSpeechRecognition === 'function';

  const deviceSelection =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.enumerateDevices === 'function';

  return {
    secureContext,
    getUserMedia,
    mediaRecorder,
    speechRecognition,
    deviceSelection,
    // Presence of the API is the operative test, not `isSecureContext`: on
    // http the constructor is simply missing. The flag only explains WHY.
    canRecord: getUserMedia && mediaRecorder,
  };
};

/**
 * Why recording is impossible, when it is.
 *
 * Separate from `canRecord` because "your browser cannot do this" and "this
 * page is not on https" need different instructions, and telling a student on
 * a plain-http dev server that their browser is too old sends them to fix the
 * wrong thing.
 */
export const unsupportedReason = (
  support: RecordingSupport,
): RecordingErrorKind => (support.secureContext ? 'UNSUPPORTED' : 'INSECURE_CONTEXT');

/**
 * Map a getUserMedia rejection to one of our kinds.
 *
 * Switched on `error.name`, which is the part of DOMException the spec pins
 * down; `message` is free-form vendor prose and differs per browser and locale.
 * The legacy aliases are the names older WebKit/Blink still throw.
 */
export const classifyMicrophoneError = (error: unknown): RecordingErrorKind => {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'PERMISSION_DENIED';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'DEVICE_NOT_FOUND';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'DEVICE_CONSTRAINT_UNMET';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'DEVICE_BUSY';
    case 'AbortError':
      return 'DEVICE_ABORTED';
    case 'SecurityError':
      return 'INSECURE_CONTEXT';
    default:
      // Deliberately NOT a generic "unknown error" bucket shared with the
      // named cases above: this one means the recorder failed for a reason we
      // have not seen, and its copy says exactly that.
      return 'RECORDER_FAILED';
  }
};

/**
 * Open the microphone.
 *
 * `echoCancellation` is on because the student may be wearing no headphones
 * and the recording sits next to a playing video; it is the browser's own
 * mitigation and costs nothing to ask for. Whether it is sufficient is a
 * listening judgement that belongs in manual QA, not an assumption made here.
 */
export const requestMicrophoneStream = (deviceId?: string): Promise<MediaStream> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new DOMException('getUserMedia unavailable', 'SecurityError'));
  }
  const processing = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  return navigator.mediaDevices.getUserMedia({
    // `exact`, never `ideal`. An `ideal` deviceId lets the browser quietly
    // substitute a different microphone, which is precisely the failure this
    // phase exists to end: the student would choose Realtek, be given the
    // virtual device again, and have no way to tell.
    audio: deviceId ? { deviceId: { exact: deviceId }, ...processing } : processing,
  });
};

/**
 * Stop every track and release the device.
 *
 * Called on every exit path. Leaving a track live keeps the OS recording
 * indicator lit after the student has stopped, which reads as the app
 * listening to them — the single most alarming thing a microphone feature can
 * do wrong.
 */
export const stopStream = (stream: MediaStream | null | undefined): void => {
  stream?.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
};

/* ── device enumeration ─────────────────────────────────────────────────── */

export interface AudioInputDevice {
  deviceId: string;
  /** What to show the student. Never a raw id — see `describeDevice`. */
  label: string;
  /** The browser's grouping of one physical device's inputs and outputs. */
  groupId: string;
  /**
   * The OS default, which browsers expose as the reserved id `'default'`.
   *
   * Worth keeping because it is the entry that moves: it follows the system
   * setting, so a student who fixes their default in Windows sees this one
   * start working without touching the app.
   */
  isSystemDefault: boolean;
}

/**
 * A name for a device, without ever showing a raw id.
 *
 * Labels are empty until microphone permission has been granted — that is a
 * privacy feature of the platform, not a bug, and it is why enumeration only
 * happens after the prompt. Where a label is still missing the fallback is a
 * position ("Microphone 2"), because a 64-hex-character `deviceId` is not a
 * name, identifies the machine, and is exactly the sort of thing that ends up
 * copied into a support chat.
 */
export const describeDevice = (
  device: { deviceId: string; label?: string },
  index: number,
): string => {
  const label = device.label?.trim();
  if (label) return label;
  return device.deviceId === 'default' ? 'System default' : `Microphone ${index + 1}`;
};

/**
 * Every audio input the browser will admit to.
 *
 * DELIBERATELY UNFILTERED. Phase 3.1 exists because Chrome silently chose a
 * "Voice Changer Virtual Audio Device (WDM)" that produced pure silence — and
 * the temptation is to blocklist devices whose names look virtual. That would
 * be wrong twice over: device names are vendor strings with no stability
 * guarantee and no schema, and plenty of legitimate setups (loopback capture,
 * broadcast mixers, USB interfaces) look exactly like the thing being
 * excluded. **The signal is measured, not guessed** — the preflight answers
 * this question with amplitude, which is the only evidence that transfers
 * across machines the developer has never seen.
 */
/**
 * Does this origin already hold microphone permission — checked WITHOUT
 * opening a stream and WITHOUT ever being able to raise a prompt.
 *
 * `enumerateDevices` is safe to call at any time, from any context, with no
 * user gesture: it is the one capture-related call in this module the spec
 * guarantees never surfaces a permission UI. What it returns differs by
 * permission state — every `audioinput` label is the empty string until this
 * origin has been granted access (see `describeDevice` above). A non-empty
 * label is therefore proof, not a guess, that permission already exists —
 * from an earlier visit's click, a synced browser profile, or a persistent
 * grant set up outside this app entirely.
 */
export const probeGrantedMicrophonePermission = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return false;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(
      (device) => device.kind === 'audioinput' && Boolean(device.label?.trim()),
    );
  } catch {
    // Same posture as enumerateAudioInputs: a rejection degrades to "treat as
    // not yet granted", which is the safe direction to be wrong in.
    return false;
  }
};

export const enumerateAudioInputs = async (): Promise<AudioInputDevice[]> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'audioinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: describeDevice(device, index),
        groupId: device.groupId ?? '',
        isSystemDefault: device.deviceId === 'default',
      }));
  } catch {
    // enumerateDevices can reject under a restrictive permissions policy. An
    // empty list degrades to "no chooser", which still records.
    return [];
  }
};

/**
 * Subscribe to hardware appearing or disappearing. Returns an unsubscribe.
 *
 * Returns a no-op teardown where the event does not exist, so callers can call
 * it unconditionally in a `useEffect` cleanup rather than guarding.
 */
export const subscribeToDeviceChange = (handler: () => void): (() => void) => {
  const target = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!target?.addEventListener) return () => undefined;
  target.addEventListener('devicechange', handler);
  return () => target.removeEventListener('devicechange', handler);
};

/**
 * Is this track actually going to deliver anything?
 *
 * `readyState === 'ended'` means the device is gone; `enabled === false` means
 * something has muted it. Both are cheap to read and both are checked before
 * recording starts, because starting a recorder on a dead track is how this
 * phase's bug reached a student in the first place.
 */
export const isTrackUsable = (stream: MediaStream | null): boolean => {
  const track = stream?.getAudioTracks()[0];
  if (!track) return false;
  return track.enabled !== false && track.readyState !== 'ended';
};

/* ── input level ────────────────────────────────────────────────────────── */

export interface InputLevelMeter {
  /** Peak amplitude in the most recent window, 0..1. Read from the tick. */
  read(): number;
  /**
   * Loudest sample seen since the meter opened, 0..1.
   *
   * Exactly 0 means every sample the microphone delivered was silence — not
   * "quiet", but the numeric zero. A live person in a silent room still moves
   * this off zero within a frame or two; only a muted or disconnected track
   * holds it there.
   */
  peak(): number;
  /**
   * Whether the graph is actually processing audio.
   *
   * An `AudioContext` can be created `suspended` (autoplay policy), and a
   * suspended analyser returns a buffer of perfect mid-points — indistinguishable
   * from a muted microphone. Without this, a suspended context would report
   * silence and the preflight would refuse to let a student with a working
   * microphone record at all. **Unmeasured is not a verdict**, and this is the
   * flag that tells the difference.
   */
  running(): boolean;
  close(): void;
}

/**
 * Watch what the microphone is ACTUALLY delivering.
 *
 * This exists because of a bug that was invisible without it. Chrome recorded
 * a seven-second file containing no audio: the timer ran, MediaRecorder emitted
 * chunks, `getUserMedia` had resolved, no error was thrown anywhere — and the
 * samples were all zero. Every signal the app had said the recording was fine.
 * Measuring the signal itself is the only thing that disagrees.
 *
 * THE GRAPH DELIBERATELY HAS NO DESTINATION. `source -> analyser` and nothing
 * else: connecting to `context.destination` would play the microphone out of
 * the speakers while the student is recording, which is a feedback loop and,
 * worse, would then be captured by the recording.
 *
 * Returns null wherever WebAudio is absent (and in jsdom, which has no
 * AudioContext). A null meter is not an error — it means this run has no
 * measurement, and the silence check below is skipped rather than guessed.
 */
export const createInputLevelMeter = (stream: MediaStream): InputLevelMeter | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (typeof Ctor !== 'function') return null;

  try {
    const context = new Ctor();
    // Created from a user gesture, so this should already be running; resumed
    // anyway because a suspended context measures silence for every device.
    if (context.state === 'suspended') void context.resume();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.fftSize);
    let peak = 0;
    let closed = false;

    return {
      read() {
        if (closed) return 0;
        analyser.getByteTimeDomainData(buffer);
        let loudest = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          // Time-domain bytes are centred on 128; distance from centre is
          // amplitude, and the sign does not matter for a level meter.
          const amplitude = Math.abs(buffer[i] - 128) / 128;
          if (amplitude > loudest) loudest = amplitude;
        }
        if (loudest > peak) peak = loudest;
        return loudest;
      },
      peak: () => peak,
      running: () => !closed && context.state === 'running',
      close() {
        if (closed) return;
        closed = true;
        try {
          source.disconnect();
          analyser.disconnect();
          void context.close();
        } catch {
          // Already closed, or an engine that disallows closing twice.
        }
      },
    };
  } catch {
    // A meter is diagnostic. If WebAudio refuses the stream, recording still
    // works and must not be taken down by the instrument watching it.
    return null;
  }
};

/* ── Web Speech API ─────────────────────────────────────────────────────── */

export interface SpeechAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternativeLike;
}

export interface SpeechResultListLike {
  readonly length: number;
  [index: number]: SpeechResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  /** 'no-speech' | 'aborted' | 'audio-capture' | 'not-allowed' | 'network' | … */
  error: string;
  message?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * A configured recogniser, or null where the API does not exist.
 *
 * Null is an ordinary answer, not a failure: recording and playback are the
 * Phase 3 deliverable and both work without it.
 */
export const createSpeechRecognition = (
  lang: string,
): SpeechRecognitionLike | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = lang;
  // `continuous` so a pause mid-sentence does not end the session early, and
  // `interimResults` because showing words as they are heard is the whole
  // point of a realtime transcript.
  recognition.continuous = true;
  recognition.interimResults = true;
  // One alternative. Phase 3 shows the raw transcript and compares nothing, so
  // asking for ranked alternatives would collect data with no reader.
  recognition.maxAlternatives = 1;
  return recognition;
};
