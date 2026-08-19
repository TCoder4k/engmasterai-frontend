import { vi } from 'vitest';

// Sprint 11 Phase 3 — fakes for the capture APIs jsdom does not implement.
//
// jsdom has no MediaRecorder, no Web Speech API, no getUserMedia and no
// URL.createObjectURL. Every one of those is REQUIRED for the recorder to do
// anything, so without doubles the hook has no testable behaviour at all — and
// the behaviour most worth testing (does the device get released? does the
// object URL get revoked?) is invisible in a real browser too.
//
// The doubles are deliberately synchronous and driveable: a test decides when
// a chunk arrives, when recognition returns a word and when a track ends. That
// is the only way to assert on the ordering this hook exists to manage.
//
// Not a .test file, so it is never collected as a suite; not imported by any
// component, so it is never bundled.

export class FakeMediaRecorder {
  static supportedTypes = new Set<string>(['audio/webm;codecs=opus']);
  static instances: FakeMediaRecorder[] = [];
  /** Set to make construction throw, i.e. a codec the engine will not record. */
  static failOnConstruct = false;
  /** Set to make `stop()` produce no chunks — the empty-recording path. */
  static produceEmptyBlob = false;
  /**
   * Set to reproduce the Chrome failure browser QA found: a ~110-byte WebM
   * container header with no audio clusters. NOT zero bytes, which is why a
   * `size === 0` check never caught it.
   */
  static produceHeaderOnlyBlob = false;
  /** Records whether the mic tracks were still live when the blob was flushed. */
  static tracksLiveAtFlush: boolean | null = null;

  static isTypeSupported = (type: string): boolean =>
    FakeMediaRecorder.supportedTypes.has(type);

  static reset(): void {
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.failOnConstruct = false;
    FakeMediaRecorder.produceEmptyBlob = false;
    FakeMediaRecorder.produceHeaderOnlyBlob = false;
    FakeMediaRecorder.tracksLiveAtFlush = null;
    FakeMediaRecorder.supportedTypes = new Set(['audio/webm;codecs=opus']);
  }

  static latest(): FakeMediaRecorder {
    const last = FakeMediaRecorder.instances.at(-1);
    if (!last) throw new Error('No MediaRecorder was constructed');
    return last;
  }

  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    public readonly stream: unknown,
    options?: { mimeType?: string },
  ) {
    if (FakeMediaRecorder.failOnConstruct) {
      throw new DOMException('unsupported mimeType', 'NotSupportedError');
    }
    this.mimeType = options?.mimeType ?? 'audio/webm';
    FakeMediaRecorder.instances.push(this);
  }

  /** Records the timeslice the hook asked for, so a test can assert it did. */
  timeslice: number | undefined = undefined;

  start(timeslice?: number): void {
    this.state = 'recording';
    this.timeslice = timeslice;
  }

  stop(): void {
    if (this.state === 'inactive') return;
    this.state = 'inactive';

    // The whole point of the Chrome bug: whether the microphone tracks are
    // still live at the moment the encoder flushes. A real MediaRecorder that
    // is cut off here produces a container header and nothing else.
    const stream = this.stream as { getAudioTracks?: () => FakeTrack[] } | null;
    const tracks = stream?.getAudioTracks?.() ?? [];
    FakeMediaRecorder.tracksLiveAtFlush =
      tracks.length > 0 ? tracks.every((track) => track.stop.mock.calls.length === 0) : null;

    if (!FakeMediaRecorder.produceEmptyBlob) {
      const bytes = FakeMediaRecorder.produceHeaderOnlyBlob ? 110 : 4096;
      this.ondataavailable?.({
        data: new Blob([new Uint8Array(bytes)], { type: this.mimeType }),
      });
    }
    this.onstop?.();
  }

  /** Drive the MediaRecorder `error` event. */
  emitError(): void {
    this.onerror?.();
  }
}

/**
 * Enough of WebAudio for the input level meter.
 *
 * jsdom has no AudioContext, and without one `createInputLevelMeter` returns
 * null and the silence check never runs — so the fake is installed BY DEFAULT.
 * A test environment where the meter is quietly absent would leave the
 * measurement that catches silent capture untested on every path except the two
 * that ask for it by name.
 *
 * `sampleAmplitude` is the whole knob: 0 makes every sample exactly the 128
 * mid-point, which is what a muted track looks like to an analyser.
 */
/**
 * Enough of a ScriptProcessorNode for useSpeakingLiveCapture's PCM16
 * streaming graph — jsdom has neither AudioWorklet nor
 * ScriptProcessorNode, so this is the only way `onaudioprocess` can ever
 * fire in a test. `emitAudioProcess` is the test-driven equivalent of the
 * browser calling it on a real audio-buffer boundary.
 */
export class FakeScriptProcessorNode {
  onaudioprocess: ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void) | null =
    null;
  connect(): void {}
  disconnect(): void {}
  emitAudioProcess(samples: Float32Array): void {
    this.onaudioprocess?.({ inputBuffer: { getChannelData: () => samples } });
  }
}

/** Enough of a GainNode for the silent monitoring tap useSpeakingLiveCapture routes its processor through. */
export class FakeGainNode {
  gain = { value: 1 };
  connect(): void {}
  disconnect(): void {}
}

/**
 * Enough of an AudioBufferSourceNode for useSpeakingLivePlayback's gapless
 * scheduling — `start()` records that it was asked to play rather than
 * actually playing anything (jsdom has no audio output), and `onended`
 * fires only when a test explicitly calls `triggerEnded()`, the same
 * test-controlled-completion pattern the old TTS-based test used for
 * observing AI_SPEAKING via a manual `endSpeech()`.
 */
export class FakeAudioBufferSourceNode {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  started = false;
  startedAt: number | undefined;
  connect(): void {}
  start(when?: number): void {
    this.started = true;
    this.startedAt = when;
  }
  triggerEnded(): void {
    this.onended?.();
  }
}

/** A fake `AudioBuffer` — just enough shape for useSpeakingLivePlayback to read `.duration` and write into `.getChannelData()`. */
export class FakeAudioBuffer {
  private readonly channelData: Float32Array;
  constructor(
    public readonly numberOfChannels: number,
    public readonly length: number,
    public readonly sampleRate: number,
  ) {
    this.channelData = new Float32Array(length);
  }
  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(): Float32Array {
    return this.channelData;
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  /** Distance from the 128 mid-point the fake analyser reports. 0 = digital silence. */
  static sampleAmplitude = 40;
  /** Set to make construction throw — WebAudio present but refusing the stream. */
  static failOnConstruct = false;
  /**
   * Set to reproduce a browser that silently ignores the requested
   * `{ sampleRate }` constructor option and keeps its own device rate
   * instead (real Web Audio behaviour some engines exhibit — see
   * useSpeakingLiveCapture's own resampleTo16k comment for why this
   * matters: mislabeling that mismatched audio as 16kHz to Gemini is what
   * produced unintelligible, hallucinated transcripts in production).
   * `null` (default) means the request is honoured, matching the common
   * case every other test in this suite relies on.
   */
  static forceSampleRate: number | null = null;

  static reset(): void {
    FakeAudioContext.instances = [];
    FakeAudioContext.sampleAmplitude = 40;
    FakeAudioContext.failOnConstruct = false;
    FakeAudioContext.forceSampleRate = null;
  }

  static latest(): FakeAudioContext {
    const last = FakeAudioContext.instances.at(-1);
    if (!last) throw new Error('No AudioContext was constructed');
    return last;
  }

  closed = false;
  sourceDisconnected = false;
  /** Set to 'suspended' to reproduce an autoplay-blocked context, which measures silence. */
  state: 'running' | 'suspended' | 'closed' = 'running';
  /** Recorded so a test can assert useSpeakingLiveCapture asked for 16kHz specifically — distinct from the ACTUAL `sampleRate` below, which is what a real AudioContext reports back and may differ. */
  readonly requestedSampleRate: number | undefined;
  /** The context's real, effective rate — what `AudioContext.sampleRate` actually returns. Honours the request unless `forceSampleRate` says otherwise. */
  readonly sampleRate: number;
  /** The most recently created processor — useSpeakingLiveCapture creates exactly one per start(). */
  processorNode: FakeScriptProcessorNode | null = null;
  /** Every buffer-source node created, in order — useSpeakingLivePlayback creates one per audio chunk (plus one per replay()). */
  bufferSources: FakeAudioBufferSourceNode[] = [];
  /** Static per Web Audio's own spec, but never actually advances here — gapless scheduling only needs it to exist. */
  currentTime = 0;

  resume(): Promise<void> {
    if (this.state === 'suspended') this.state = 'running';
    return Promise.resolve();
  }

  constructor(options?: { sampleRate?: number }) {
    if (FakeAudioContext.failOnConstruct) throw new Error('audio context unavailable');
    this.requestedSampleRate = options?.sampleRate;
    this.sampleRate = FakeAudioContext.forceSampleRate ?? options?.sampleRate ?? 44100;
    FakeAudioContext.instances.push(this);
  }

  createMediaStreamSource(): { connect: () => void; disconnect: () => void } {
    return {
      connect: () => undefined,
      disconnect: () => {
        this.sourceDisconnected = true;
      },
    };
  }

  createAnalyser(): {
    fftSize: number;
    getByteTimeDomainData: (buffer: Uint8Array) => void;
    disconnect: () => void;
  } {
    return {
      fftSize: 2048,
      getByteTimeDomainData: (buffer: Uint8Array) => {
        buffer.fill(128);
        if (FakeAudioContext.sampleAmplitude !== 0) {
          buffer[7] = 128 + FakeAudioContext.sampleAmplitude;
        }
      },
      disconnect: () => undefined,
    };
  }

  createScriptProcessor(): FakeScriptProcessorNode {
    const processor = new FakeScriptProcessorNode();
    this.processorNode = processor;
    return processor;
  }

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource(): FakeAudioBufferSourceNode {
    const source = new FakeAudioBufferSourceNode();
    this.bufferSources.push(source);
    return source;
  }

  get destination(): { connect: () => void } {
    return { connect: () => undefined };
  }

  close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

export interface FakeSpeechResultShape {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: { transcript: string; confidence: number };
    };
  };
}

export class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  /** Set to make `start()` throw — Chrome does this when one is already running. */
  static failOnStart = false;

  static reset(): void {
    FakeSpeechRecognition.instances = [];
    FakeSpeechRecognition.failOnStart = false;
  }

  static latest(): FakeSpeechRecognition {
    const last = FakeSpeechRecognition.instances.at(-1);
    if (!last) throw new Error('No SpeechRecognition was constructed');
    return last;
  }

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  started = false;

  onresult: ((event: FakeSpeechResultShape) => void) | null = null;
  onerror: ((event: { error: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start(): void {
    if (FakeSpeechRecognition.failOnStart) {
      throw new DOMException('already started', 'InvalidStateError');
    }
    this.started = true;
    this.onstart?.();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.onend?.();
  }

  abort(): void {
    this.started = false;
  }

  emitResult(transcript: string, isFinal: boolean): void {
    this.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        0: { isFinal, length: 1, 0: { transcript, confidence: 0.92 } },
      },
    });
  }

  emitError(error: string): void {
    this.onerror?.({ error });
  }
}

export interface FakeTrack {
  kind: string;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

export const createFakeStream = (): { stream: MediaStream; track: FakeTrack } => {
  const track: FakeTrack = { kind: 'audio', stop: vi.fn(), onended: null };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  };
  return { stream: stream as unknown as MediaStream, track };
};

/**
 * The device list a test wants `enumerateDevices` to return.
 *
 * Defaults deliberately mirror the machine this phase came from: Chrome's
 * `'default'` entry pointing at a virtual audio device, with the real Realtek
 * microphone second. A fixture that only ever contains one working microphone
 * cannot reproduce the bug it is meant to prevent.
 */
export const DEFAULT_FAKE_DEVICES = [
  {
    kind: 'audioinput',
    deviceId: 'default',
    label: 'Voice Changer Virtual Audio Device (WDM)',
    groupId: 'group-virtual',
  },
  {
    kind: 'audioinput',
    deviceId: 'realtek-1',
    label: 'Microphone (Realtek(R) Audio)',
    groupId: 'group-realtek',
  },
  // Present so a test can prove the filter is a filter: this must never reach
  // the chooser.
  {
    kind: 'audiooutput',
    deviceId: 'speakers-1',
    label: 'Speakers (Realtek(R) Audio)',
    groupId: 'group-realtek',
  },
];

export interface RecordingMocks {
  stream: MediaStream;
  track: FakeTrack;
  getUserMedia: ReturnType<typeof vi.fn>;
  enumerateDevices: ReturnType<typeof vi.fn>;
  createObjectURL: ReturnType<typeof vi.fn>;
  revokeObjectURL: ReturnType<typeof vi.fn>;
  /** Fire a `devicechange` event at whatever subscribed. */
  emitDeviceChange: () => void;
  /** Replace the list `enumerateDevices` resolves with, e.g. after an unplug. */
  setDevices: (devices: unknown[]) => void;
  /** How many `devicechange` listeners are currently attached — proves cleanup. */
  deviceChangeListenerCount: () => number;
}

interface InstallOptions {
  /** Reject getUserMedia with this DOMException name. */
  denyWith?: string;
  /** Omit MediaRecorder entirely — an engine that cannot record. */
  withoutMediaRecorder?: boolean;
  /** Omit the Web Speech API — Firefox. Recording must still work. */
  withoutSpeechRecognition?: boolean;
  /** Omit WebAudio, so there is no level meter and no silence measurement. */
  withoutAudioContext?: boolean;
  /** Omit `enumerateDevices` — no chooser can be offered. */
  withoutDeviceSelection?: boolean;
  /** Start from a specific device list instead of DEFAULT_FAKE_DEVICES. */
  devices?: unknown[];
  /**
   * Seed as if this origin already holds permission from an earlier visit —
   * `enumerateDevices` returns real labels from the very first call, with no
   * prior `getUserMedia`. Default false, matching a fresh browser profile.
   */
  alreadyGranted?: boolean;
}

/**
 * Install the doubles on `window` / `navigator` / `URL`.
 *
 * Assigned rather than `vi.stubGlobal`d for `navigator.mediaDevices`, which is
 * a getter jsdom does not define at all; `configurable: true` so `restore` can
 * take it away again and leave the next test a clean environment.
 */
export const installRecordingMocks = (
  options: InstallOptions = {},
): RecordingMocks => {
  const { stream, track } = createFakeStream();
  FakeMediaRecorder.reset();
  FakeSpeechRecognition.reset();
  FakeAudioContext.reset();

  // Mirrors the real platform rule `describeDevice`/`enumerateAudioInputs`
  // depend on: `enumerateDevices` returns blank labels until permission has
  // actually been granted, and a resolved `getUserMedia` IS that grant. A
  // fixture that always returns full labels — regardless of whether
  // `getUserMedia` was ever called — cannot exercise the silent mount-time
  // probe at all, which is exactly what it needs to prove.
  let permissionGranted = options.alreadyGranted ?? false;

  const getUserMedia = vi.fn(() => {
    if (options.denyWith) {
      return Promise.reject(new DOMException('denied', options.denyWith));
    }
    permissionGranted = true;
    return Promise.resolve(stream);
  });

  let devices = options.devices ?? DEFAULT_FAKE_DEVICES;
  const enumerateDevices = vi.fn(() =>
    Promise.resolve(
      permissionGranted
        ? devices
        : devices.map((device) => ({ ...(device as Record<string, unknown>), label: '' })),
    ),
  );
  const deviceChangeListeners = new Set<() => void>();

  Object.defineProperty(window, 'isSecureContext', {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia,
      ...(options.withoutDeviceSelection ? {} : { enumerateDevices }),
      addEventListener: (type: string, handler: () => void) => {
        if (type === 'devicechange') deviceChangeListeners.add(handler);
      },
      removeEventListener: (type: string, handler: () => void) => {
        if (type === 'devicechange') deviceChangeListeners.delete(handler);
      },
    },
    configurable: true,
  });

  if (options.withoutMediaRecorder) {
    delete (window as unknown as Record<string, unknown>).MediaRecorder;
  } else {
    (window as unknown as Record<string, unknown>).MediaRecorder = FakeMediaRecorder;
  }

  if (options.withoutSpeechRecognition) {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  } else {
    (window as unknown as Record<string, unknown>).SpeechRecognition =
      FakeSpeechRecognition;
  }

  if (options.withoutAudioContext) {
    delete (window as unknown as Record<string, unknown>).AudioContext;
    delete (window as unknown as Record<string, unknown>).webkitAudioContext;
  } else {
    (window as unknown as Record<string, unknown>).AudioContext = FakeAudioContext;
  }

  const createObjectURL = vi.fn(() => `blob:fake/${Math.random().toString(36).slice(2)}`);
  const revokeObjectURL = vi.fn();
  (URL as unknown as Record<string, unknown>).createObjectURL = createObjectURL;
  (URL as unknown as Record<string, unknown>).revokeObjectURL = revokeObjectURL;

  return {
    stream,
    track,
    getUserMedia,
    enumerateDevices,
    createObjectURL,
    revokeObjectURL,
    emitDeviceChange: () => {
      deviceChangeListeners.forEach((handler) => handler());
    },
    setDevices: (next: unknown[]) => {
      devices = next;
    },
    deviceChangeListenerCount: () => deviceChangeListeners.size,
  };
};

export const restoreRecordingMocks = (): void => {
  const w = window as unknown as Record<string, unknown>;
  delete w.MediaRecorder;
  delete w.SpeechRecognition;
  delete w.webkitSpeechRecognition;
  delete w.AudioContext;
  delete w.webkitAudioContext;
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  Reflect.deleteProperty(navigator, 'mediaDevices');
  FakeMediaRecorder.reset();
  FakeSpeechRecognition.reset();
  FakeAudioContext.reset();
};
