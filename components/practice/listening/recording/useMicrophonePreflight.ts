import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classifyMicrophoneError,
  createInputLevelMeter,
  isTrackUsable,
  requestMicrophoneStream,
  stopStream,
  InputLevelMeter,
  RecordingErrorKind,
} from './recordingService';

// Sprint 11 Phase 3.1 — does this microphone deliver anything at all?
//
// THAT IS THE ONLY QUESTION THIS ANSWERS, and the wording matters. It is not a
// microphone quality test, not a level calibration and not a noise assessment.
// It measures one thing — whether any non-zero sample reaches the app — because
// that is the exact failure that shipped: a virtual audio device that opened
// cleanly, reported a live track, and produced digital silence for eight
// seconds while every indicator in the UI said recording was working.
//
// IT RUNS ON THE SAME PATH THE RECORDER WILL USE: same `getUserMedia`
// constraints, same exact deviceId, an `AnalyserNode` on the stream that call
// returns. A check that proves a *different* stream works proves nothing.
//
// UNMEASURED IS NOT A VERDICT. Where WebAudio is missing or the AudioContext
// will not run, this reports that it could not measure rather than reporting
// silence — refusing to let a student with a working microphone record, on the
// strength of a measurement that never happened, would be a worse bug than the
// one being fixed.

export type PreflightState =
  | 'IDLE'
  | 'CHECKING'
  | 'SIGNAL_DETECTED'
  | 'NO_SIGNAL'
  | 'DEVICE_ERROR';

/** How long to listen before deciding. Long enough to say a word, short enough not to be a wait. */
export const PREFLIGHT_DURATION_MS = 2_500;

/** How often the level is sampled during the check. Matches the recorder's own tick. */
export const PREFLIGHT_SAMPLE_INTERVAL_MS = 100;

/**
 * The smallest peak that counts as signal, on the meter's 0..1 scale.
 *
 * Deliberately just above nothing rather than a "speak up" threshold. A live
 * microphone in a silent room still moves off zero on its own noise floor
 * within a few frames; only a muted, disconnected or virtual-with-no-source
 * device sits at a flat zero. Setting this where a quiet student would fail it
 * would turn a diagnostic into an obstacle.
 */
export const PREFLIGHT_SIGNAL_THRESHOLD = 0.01;

export interface PreflightApi {
  state: PreflightState;
  errorKind: RecordingErrorKind | null;
  /** Live level during the check, for the meter. */
  level: number;
  /** Loudest level seen during the last completed check. */
  peak: number;
  /**
   * False when this browser cannot measure at all (no WebAudio, or a context
   * that will not run). Callers must not treat that as NO_SIGNAL.
   */
  measurable: boolean;
  start: () => void;
  reset: () => void;
}

export const useMicrophonePreflight = (deviceId: string | null): PreflightApi => {
  const [state, setState] = useState<PreflightState>('IDLE');
  const [errorKind, setErrorKind] = useState<RecordingErrorKind | null>(null);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [measurable, setMeasurable] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<InputLevelMeter | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (sampleTimerRef.current !== null) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    if (finishTimerRef.current !== null) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    meterRef.current?.close();
    meterRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState('IDLE');
    setErrorKind(null);
    setLevel(0);
    setPeak(0);
  }, [cleanup]);

  // Choosing a different microphone invalidates the previous verdict. Leaving
  // a stale SIGNAL_DETECTED on screen would let a student record on a device
  // that was never checked — which is the whole failure, one step removed.
  useEffect(() => {
    reset();
  }, [deviceId, reset]);

  const start = useCallback(() => {
    cleanup();
    setState('CHECKING');
    setErrorKind(null);
    setLevel(0);
    setPeak(0);
    setMeasurable(true);

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await requestMicrophoneStream(deviceId ?? undefined);
      } catch (caught) {
        if (!mountedRef.current) return;
        setErrorKind(classifyMicrophoneError(caught));
        setState('DEVICE_ERROR');
        return;
      }
      if (!mountedRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;

      // A track that is already ended or disabled cannot be measured, and is
      // its own answer — no point listening to it for two and a half seconds.
      if (!isTrackUsable(stream)) {
        cleanup();
        setErrorKind('DEVICE_CONSTRAINT_UNMET');
        setState('DEVICE_ERROR');
        return;
      }

      const meter = createInputLevelMeter(stream);
      meterRef.current = meter;
      if (!meter) {
        // No WebAudio. Not a failure of the microphone and not a verdict about
        // it: the check simply cannot run here, and recording must not be
        // gated on an answer that does not exist.
        cleanup();
        setMeasurable(false);
        setState('IDLE');
        return;
      }

      sampleTimerRef.current = setInterval(() => {
        setLevel(meter.read());
      }, PREFLIGHT_SAMPLE_INTERVAL_MS);

      finishTimerRef.current = setTimeout(() => {
        const observed = meter.peak();
        const ranProperly = meter.running();
        cleanup();
        if (!mountedRef.current) return;
        setLevel(0);
        setPeak(observed);
        if (!ranProperly && observed === 0) {
          // The audio graph never processed anything, so a reading of zero is
          // the absence of a measurement rather than the absence of a signal.
          setMeasurable(false);
          setState('IDLE');
          return;
        }
        setState(
          observed >= PREFLIGHT_SIGNAL_THRESHOLD ? 'SIGNAL_DETECTED' : 'NO_SIGNAL',
        );
      }, PREFLIGHT_DURATION_MS);
    })();
  }, [cleanup, deviceId]);

  return { state, errorKind, level, peak, measurable, start, reset };
};
