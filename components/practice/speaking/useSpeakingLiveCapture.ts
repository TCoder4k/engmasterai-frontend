import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classifyMicrophoneError,
  createInputLevelMeter,
  detectRecordingSupport,
  isTrackUsable,
  requestMicrophoneStream,
  stopStream,
  unsupportedReason,
  InputLevelMeter,
  RecordingErrorKind,
  RecordingSupport,
} from '../listening/recording/recordingService';

// Speaking Partner Live — continuous 16kHz PCM16 mic capture for Gemini
// Live, replacing `useRecorder`'s MediaRecorder-based one-blob-per-take
// model FOR SPEAKING ONLY (Shadowing keeps `useRecorder` untouched — a
// different feature with a different need: one finished clip to grade,
// not a live stream). Reuses `recordingService.ts`'s permission/error/
// level-meter plumbing as-is — none of that changes just because what
// happens to the captured audio does.
//
// SCRIPTPROCESSORNODE, NOT AUDIOWORKLETNODE. Deprecated, but universally
// supported and needs no separate worklet module file loaded via
// `audioContext.audioWorklet.addModule(url)` — for a modest 16kHz mono
// stream the main-thread overhead is negligible. AudioWorkletNode would be
// the modern replacement if this ever needs off-main-thread processing.
//
// >>> THE H1 RACE, HANDLED INSIDE THE HOOK THIS TIME <<<
// `start()` awaits `getUserMedia` before the capture graph exists, so a
// `stop()` landing in that window has nothing to tear down yet. Unlike
// `useRecorder` (an existing hook whose external contract callers already
// build their own guard around — see SpeakingRecorderControl's history),
// this is new code: the guard lives HERE, once, via `stopRequestedRef` — a
// stop during REQUESTING_PERMISSION is honoured by tearing down the stream
// the moment it arrives, before ever reaching RECORDING or calling
// `onRecordingStart`.
//
// `onRecordingStart`/`onRecordingStop` — NOT the same as the RECORDING
// state transition alone — are the seam SpeakingRecorderControl uses to
// send `activityStart`/`activityEnd` to the Live WS. They fire EXACTLY
// ONCE per genuine capture (guarded by `hasStartedRef`), and specifically
// `onRecordingStop` fires on every exit from a real recording — an
// explicit stop(), hitting maxDurationMs, or the track ending unexpectedly
// (PERMISSION_REVOKED) — so a turn that was actually opened with Gemini is
// always, eventually, closed with it. A stop() during REQUESTING_PERMISSION
// never fires either callback: no activityStart was ever sent, so there is
// nothing for the server to close.

export type LiveCaptureState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'RECORDING'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'ERROR';

const CAPTURE_SAMPLE_RATE = 16000;
const PROCESSOR_BUFFER_SIZE = 4096;
const TICK_MS = 200;

export interface UseSpeakingLiveCaptureOptions {
  maxDurationMs?: number;
  /**
   * The student's chosen microphone (from `useMicrophones`'s resolved
   * `selected.deviceId`, same source Shadowing already uses), or
   * null/undefined to fall back to the browser's own default device.
   * WITHOUT this, `requestMicrophoneStream()` grabs whatever `getUserMedia`
   * treats as the "default" input — which Sprint 11 Phase 3.1 already
   * documented can silently be a silent virtual device on some machines,
   * ahead of the real microphone in the device list (see
   * `useMicrophones.ts`'s own header). Real 2026-08-20 bug: exactly this,
   * confirmed by SpeakingLiveAudioDiagnostics reporting rms=0/peak=0 on
   * every turn while Shadowing (which already threads a resolved deviceId
   * through) transcribed the same speaker correctly on the same machine.
   */
  deviceId?: string | null;
  /** One base64-encoded 16-bit PCM chunk, 16kHz mono, little-endian. */
  onAudioChunk: (base64Pcm16: string) => void;
  /** Fires exactly once when capture genuinely begins — send `activityStart` here. */
  onRecordingStart?: () => void;
  /** Fires exactly once when a genuine capture ends — send `activityEnd` here. */
  onRecordingStop?: () => void;
}

export interface SpeakingLiveCaptureApi {
  state: LiveCaptureState;
  errorKind: RecordingErrorKind | null;
  support: RecordingSupport;
  inputLevel: number;
  hasLevelMeter: boolean;
  isRecording: boolean;
  start: () => void;
  stop: () => void;
}

// The AudioContext is constructed with `{ sampleRate: CAPTURE_SAMPLE_RATE }`,
// but the Web Audio spec allows an implementation to silently keep the
// device's native rate instead (Windows shared-mode audio devices commonly
// run at 44100/48000Hz) — there is no exception, just a `context.sampleRate`
// that doesn't match what was asked for. Gemini Live is told every chunk is
// `audio/pcm;rate=16000` regardless, so an unresampled mismatch here sends
// audio at up to 3x its declared rate — speech compressed into something
// Gemini's STT cannot recognise, which it then fills in with a plausible-
// sounding hallucination instead of erroring. Resampling defensively (linear
// interpolation — sufficient for speech at this ratio) makes the outgoing
// PCM actually match its own mimeType instead of trusting the browser.
const resampleTo16k = (input: Float32Array, inputSampleRate: number): Float32Array => {
  if (inputSampleRate === CAPTURE_SAMPLE_RATE) return input;
  const ratio = inputSampleRate / CAPTURE_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, input.length - 1);
    const weight = srcIndex - lower;
    output[i] = input[lower] * (1 - weight) + input[upper] * weight;
  }
  return output;
};

const floatTo16BitPcm = (input: Float32Array): Int16Array => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

const int16ToBase64 = (samples: Int16Array): string => {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const useSpeakingLiveCapture = ({
  maxDurationMs = 60_000,
  deviceId,
  onAudioChunk,
  onRecordingStart,
  onRecordingStop,
}: UseSpeakingLiveCaptureOptions): SpeakingLiveCaptureApi => {
  const [support] = useState<RecordingSupport>(() => detectRecordingSupport());
  const [state, setState] = useState<LiveCaptureState>(() =>
    support.canRecord ? 'IDLE' : 'UNSUPPORTED',
  );
  const [errorKind, setErrorKind] = useState<RecordingErrorKind | null>(() =>
    support.canRecord ? null : unsupportedReason(support),
  );
  const [inputLevel, setInputLevel] = useState(0);
  const [hasLevelMeter, setHasLevelMeter] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const meterRef = useRef<InputLevelMeter | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const stopRequestedRef = useRef(false);
  /**
   * True for exactly the async gap between `start()` being called and
   * `getUserMedia` settling. `stop()` reads THIS, not the React `state`
   * value — `state` is only updated via `setState`, which does not apply
   * synchronously, so a `stop()` called synchronously from inside `start()`'s
   * own async continuation (the deferred-stop replay below) would see a
   * STALE `state` still reading REQUESTING_PERMISSION even after RECORDING
   * has already been entered. A ref has no such lag.
   */
  const isRequestingRef = useRef(false);
  /** True once `onRecordingStart` has fired for the CURRENT start() cycle — guards `onRecordingStop` from firing without a matching start, and from firing twice. */
  const hasStartedRef = useRef(false);

  const callbacksRef = useRef({ onAudioChunk, onRecordingStart, onRecordingStop, maxDurationMs, deviceId });
  callbacksRef.current = { onAudioChunk, onRecordingStart, onRecordingStop, maxDurationMs, deviceId };

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const closeMeter = useCallback(() => {
    const meter = meterRef.current;
    meterRef.current = null;
    meter?.close();
  }, []);

  /** Tears down every live resource. Does NOT fire onRecordingStop — callers decide that. */
  const teardown = useCallback(() => {
    clearTick();

    const processor = processorRef.current;
    processorRef.current = null;
    if (processor) processor.onaudioprocess = null;
    processor?.disconnect();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;

    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') {
      context.close().catch(() => {
        // Best-effort — an already-closing context throwing here changes nothing.
      });
    }

    closeMeter();
    stopStream(streamRef.current);
    streamRef.current = null;
  }, [clearTick, closeMeter]);

  const stop = useCallback(() => {
    if (isRequestingRef.current) {
      // Nothing to tear down yet — the deferred-stop replay in start()'s
      // own async continuation honours this the moment permission actually
      // resolves (see isRequestingRef's own comment for why this reads a
      // ref, not `state`).
      stopRequestedRef.current = true;
      return;
    }
    if (!streamRef.current && !audioContextRef.current) return; // already idle

    const wasRecording = hasStartedRef.current;
    teardown();
    hasStartedRef.current = false;
    setInputLevel(0);
    setState((prev) => (prev === 'RECORDING' || prev === 'ERROR' ? 'IDLE' : prev));
    if (wasRecording) callbacksRef.current.onRecordingStop?.();
  }, [teardown]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const start = useCallback(() => {
    if (!support.canRecord) {
      setErrorKind(unsupportedReason(support));
      setState('UNSUPPORTED');
      return;
    }

    teardown(); // anything left from a previous cycle goes first
    hasStartedRef.current = false;
    stopRequestedRef.current = false;
    isRequestingRef.current = true;
    setErrorKind(null);
    setInputLevel(0);
    setHasLevelMeter(false);
    setState('REQUESTING_PERMISSION');

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await requestMicrophoneStream(callbacksRef.current.deviceId ?? undefined);
      } catch (caught) {
        isRequestingRef.current = false;
        const kind = classifyMicrophoneError(caught);
        setErrorKind(kind);
        setState(kind === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'ERROR');
        return;
      }
      isRequestingRef.current = false;

      if (!isTrackUsable(stream)) {
        stopStream(stream);
        setErrorKind('DEVICE_CONSTRAINT_UNMET');
        setState('ERROR');
        return;
      }
      streamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          const wasRecording = hasStartedRef.current;
          teardown();
          hasStartedRef.current = false;
          setErrorKind('PERMISSION_REVOKED');
          setState('ERROR');
          if (wasRecording) callbacksRef.current.onRecordingStop?.();
        };
      });

      meterRef.current = createInputLevelMeter(stream);
      setHasLevelMeter(meterRef.current !== null);

      let context: AudioContext;
      try {
        const Ctor = (
          window as unknown as {
            AudioContext?: typeof AudioContext;
            webkitAudioContext?: typeof AudioContext;
          }
        ).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) throw new Error('AudioContext unavailable');
        // Some browsers ignore an unsupported sampleRate rather than
        // throwing; either way Gemini Live needs exactly 16kHz, so this is
        // the one true source of that constraint, not a hope.
        context = new Ctor({ sampleRate: CAPTURE_SAMPLE_RATE });
      } catch {
        stopStream(stream);
        streamRef.current = null;
        closeMeter();
        setErrorKind('RECORDER_FAILED');
        setState('ERROR');
        return;
      }
      audioContextRef.current = context;

      // A freshly-constructed context can start 'suspended' (autoplay
      // policy) — this one is built right after an indefinite,
      // human-driven permission-prompt gap, exactly the kind of async gap
      // that can cost the "sticky user activation" a context needs to
      // start running. AWAITED, not fire-and-forget: onaudioprocess must
      // not be relied on before the context genuinely reaches 'running'.
      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch {
          // best-effort — a failed resume just means onaudioprocess won't
          // fire until the context transitions on its own; not fatal here.
        }
      }
      if (audioContextRef.current !== context) {
        // A stop() (or a fresh start() superseding this cycle) already tore
        // this context down while the resume above was in flight — whoever
        // did that already handled teardown/state, so there is no capture
        // graph left to build.
        return;
      }
      if (import.meta.env.DEV) {
        const track = stream.getAudioTracks()[0];
        // eslint-disable-next-line no-console
        console.debug('[SpeakingLive] mic capture context', {
          requestedSampleRate: CAPTURE_SAMPLE_RATE,
          actualSampleRate: context.sampleRate,
          state: context.state,
          trackState: track?.readyState,
          trackEnabled: track?.enabled,
          trackMuted: track?.muted,
        });
      }

      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = context.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      processorRef.current = processor;
      // TEMPORARY diagnostic (2026-08-20) — throttled to ~1/s, never per
      // callback. Computed on the RAW getChannelData(0) output, BEFORE
      // resampleTo16k/floatTo16BitPcm touch it, specifically to split the
      // pipeline in two: if this already reads rms=0/peak=0, the fault is
      // upstream (mic stream / Web Audio graph never delivering real audio
      // to this node at all) — if it reads a healthy non-zero signal here
      // but the backend's own WAV dump (SpeakingLiveAudioDiagnostics) still
      // shows silence, the fault is downstream, in resample/encode/relay.
      let lastRawInputLogAt = 0;
      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const channel = event.inputBuffer.getChannelData(0);
        if (import.meta.env.DEV) {
          const now = Date.now();
          if (now - lastRawInputLogAt >= 1000) {
            lastRawInputLogAt = now;
            let sumSquares = 0;
            let peak = 0;
            for (let i = 0; i < channel.length; i += 1) {
              const sample = channel[i];
              sumSquares += sample * sample;
              const abs = Math.abs(sample);
              if (abs > peak) peak = abs;
            }
            const rms = Math.sqrt(sumSquares / channel.length);
            // eslint-disable-next-line no-console
            console.debug('[SpeakingLive raw input]', { samples: channel.length, rms, peak });
          }
        }
        const resampled = resampleTo16k(channel, context.sampleRate);
        const pcm16 = floatTo16BitPcm(resampled);
        callbacksRef.current.onAudioChunk(int16ToBase64(pcm16));
      };
      // A ScriptProcessorNode only actually fires `onaudioprocess` once
      // connected through to a destination in some engines. Routed through
      // a zero-gain node rather than straight to `context.destination` —
      // connecting the mic directly would audibly loop it back to speakers.
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      silentGainRef.current = silentGain;
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      hasStartedRef.current = true;
      startedAtRef.current = Date.now();
      setState('RECORDING');
      callbacksRef.current.onRecordingStart?.();

      // A stop landed while permission was still pending — honour it now
      // that recording has genuinely begun (a real, if near-instant, turn:
      // activityStart THEN activityEnd), rather than silently discarding
      // it. Matches the same "the tap was real, don't lose it" rule
      // useRecorder's own H1 fix established, adapted from a hold gesture
      // to tap-to-toggle.
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        stopRef.current();
        return;
      }

      clearTick();
      tickRef.current = setInterval(() => {
        if (meterRef.current) setInputLevel(meterRef.current.read());
        if (Date.now() - startedAtRef.current >= callbacksRef.current.maxDurationMs) {
          stopRef.current();
        }
      }, TICK_MS);
    })();
  }, [clearTick, closeMeter, support, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  const isRecording = state === 'RECORDING';
  useEffect(() => {
    if (!isRecording) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isRecording]);

  return {
    state,
    errorKind,
    support,
    inputLevel,
    hasLevelMeter,
    isRecording,
    start,
    stop,
  };
};
