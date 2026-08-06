import { useCallback, useEffect, useRef, useState } from 'react';
import { createRecordingUrl, isEmptyRecording, releaseRecordingUrl } from './blob';
import { pickRecordingMimeType } from './mimeType';
import {
  classifyMicrophoneError,
  createInputLevelMeter,
  createSpeechRecognition,
  detectRecordingSupport,
  isTrackUsable,
  requestMicrophoneStream,
  stopStream,
  unsupportedReason,
  InputLevelMeter,
  RecordingErrorKind,
  RecordingSupport,
  SpeechRecognitionLike,
} from './recordingService';

// Sprint 11 Phase 3 — record one sentence, hear it back, try again.
//
// WHAT THIS HOOK IS NOT. It does not compare, normalise, score or upload
// anything. There is no fetch in this file and no import that could reach one.
// The transcript is passed through exactly as the browser produced it; turning
// it into a judgement about a student is Phase 4B's problem, and doing any part
// of it here would put grading on the client — which this codebase does not do.
//
// NO STORE, NO CONTEXT, NO REDUX. All state is local and the owner is the page
// that calls this. A recording is not application state: it belongs to one
// sentence, one attempt, one moment, and it must die when the student leaves.
// Hoisting it to a global store would keep audio alive across navigation and
// make "did we release the microphone?" a question about the whole app instead
// of about one component.
//
// TWO ASYNCHRONOUS ENDINGS. Pressing Stop does not end the recording — it
// starts the ending. MediaRecorder flushes its final chunk in a later `stop`
// event, and SpeechRecognition delivers its final result AFTER capture has
// ceased. TRANSCRIBING is the state where both are still outstanding; RESULT is
// entered only when they have both landed, or when the timeout below decides
// they never will. Collapsing this into "stop = done" is how a recorder shows
// an empty transcript that arrives a beat later.
//
// As of the Chrome fix below only ONE of those endings can currently be
// outstanding, because recognition no longer runs during capture. The
// two-ending machinery is kept rather than collapsed: Phase 4B puts a second
// asynchronous ending back, and rebuilding it later from a simplified version
// is how the "stop = done" bug gets reintroduced.

export type RecorderState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'RECORDING'
  | 'TRANSCRIBING'
  | 'RESULT'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'ERROR';

/**
 * A hard cap on one recording.
 *
 * Not a product limit so much as a memory one: chunks accumulate in an array
 * until stop, and a student who presses Record and walks away would otherwise
 * grow that array until the tab dies. Sentences in this app are validated at
 * publish time to be at most 30s long, so the cap cannot truncate a legitimate
 * attempt at reading one.
 */
export const MAX_RECORDING_MS = 30_000;

/** How often the elapsed counter refreshes. Cosmetic; also where the cap is enforced. */
export const RECORDER_TICK_MS = 200;

/**
 * Ask MediaRecorder for a chunk every second instead of only at the end.
 *
 * >>> THIS IS A BUG FIX, NOT A TUNING KNOB <<<
 * Without a timeslice the entire recording exists only inside the encoder
 * until `stop()`, so anything that disturbs the flush loses ALL of it. That is
 * exactly what browser QA found: Chrome produced a 110-byte blob for a
 * seven-second recording — a bare WebM/EBML container header with no audio
 * clusters at all — while Edge produced 131 KB from the same code. With a
 * timeslice the chunks are already in hand, so a truncated final flush costs
 * at most the last second rather than everything.
 */
export const RECORDER_TIMESLICE_MS = 1000;

/**
 * Smallest blob that can plausibly contain audio.
 *
 * A HEURISTIC, and labelled as one. `size === 0` does not catch the failure
 * above, because a container header is not zero bytes — it is ~110 of them.
 * One second of Opus is several kilobytes, so anything under this floor after
 * a recording that ran for over a second is a container with nothing in it.
 * Deliberately far below any real recording: this must never reject audio a
 * student actually produced.
 */
export const MIN_PLAUSIBLE_BLOB_BYTES = 512;

/**
 * Whether SpeechRecognition may run while MediaRecorder holds the microphone.
 *
 * >>> FALSE, AND THIS IS THE ANSWER TO PHASE 0's BLOCKER B1 <<<
 *
 * B1 asked whether the two APIs can capture at the same time. It was never
 * measured before Phase 3 shipped; browser QA measured it the hard way. On
 * Chrome, with recognition running, `getUserMedia` resolves, the track reports
 * itself live, MediaRecorder emits chunks on schedule and the elapsed timer
 * counts up — and every audio sample is zero. The file is container framing
 * with no audio in it. Edge, on identical code, records normally.
 *
 * The Web Speech API takes no MediaStream, so the two cannot be made to share
 * one capture; each opens the device for itself, and on Chrome the second one
 * gets a muted track. There is no ordering that fixes that and no flag to ask
 * for shared access.
 *
 * So they are no longer run together, and the tie-break is not close: the audio
 * IS the Phase 3 deliverable. The transcript is displayed, compared against
 * nothing, scored by nothing and sent nowhere — losing it costs a read-only
 * panel, while losing the audio costs the feature.
 *
 * This is a named constant rather than a deletion because Phase 4B has to
 * revisit it, and its options are visible from here: recognise from the blob
 * after capture ends (the Web Speech API cannot, so this means server STT), or
 * offer recognition as a separate mode that does not record.
 *
 * Annotated `boolean` rather than left as the literal `false`, so the branches
 * it guards stay type-checked as reachable code instead of collapsing to
 * `never` — a flag whose off-state silently stops type-checking its own
 * on-state is a flag that will not survive being flipped.
 */
export const SPEECH_RECOGNITION_WHILE_RECORDING: boolean = false;

/**
 * How long a take must run before pure silence is treated as a fault.
 *
 * A recording stopped almost immediately can legitimately contain no signal —
 * the student pressed Record and Stop, or the device had not spun up yet.
 * Beyond this, a peak of exactly zero is not a quiet room; it is a track that
 * delivered nothing.
 */
export const SILENCE_VERDICT_AFTER_MS = 1_000;

/**
 * How long TRANSCRIBING waits for the two endings before giving up on them.
 *
 * Chrome does not always fire `onend` promptly after `stop()`, and on a silent
 * recording it may not fire a final result at all. Without this the UI would
 * sit on "Finishing…" forever, which is worse than an empty transcript — the
 * blob is already good and the student is waiting for nothing.
 */
export const TRANSCRIBE_TIMEOUT_MS = 3_000;

export interface UseRecorderOptions {
  /** BCP-47 tag for SpeechRecognition. The sentences are English. */
  lang?: string;
  maxDurationMs?: number;
  /**
   * Ran after the student's gesture but BEFORE the permission prompt.
   *
   * That ordering is the point: the prompt is modal and blocks, so a video
   * paused afterwards would keep playing underneath it.
   */
  onBeforeStart?: () => void;
  /**
   * Run SpeechRecognition during capture. Defaults to
   * SPEECH_RECOGNITION_WHILE_RECORDING, which is the policy.
   *
   * The option exists for two reasons and neither is convenience. First, the
   * recognition path is now off by default but must stay covered by tests —
   * untested code that ships disabled is how a feature comes back broken when
   * someone re-enables it. Second, Phase 4B has to make this decision per
   * surface rather than per build, and a caller-supplied value is the seam that
   * lets it, without every surface reaching for a module constant.
   */
  transcribeWhileRecording?: boolean;
  /**
   * The microphone to record from, pinned with `exact`.
   *
   * Null means "whatever the browser picks", which is what Phase 3 did and how
   * a student ended up recording eight seconds of a virtual audio device. It
   * remains the fallback only for engines with no `enumerateDevices`.
   */
  deviceId?: string | null;
}

export interface RecorderApi {
  state: RecorderState;
  /** Non-null in PERMISSION_DENIED, UNSUPPORTED and ERROR. Never a catch-all. */
  errorKind: RecordingErrorKind | null;
  support: RecordingSupport;
  elapsedMs: number;
  /** Final length of the finished recording; null until RESULT. */
  durationMs: number | null;
  blob: Blob | null;
  blobUrl: string | null;
  /** What the browser actually recorded, which can differ from what was asked for. */
  mimeType: string | null;
  /** Finalised speech, accumulated across the recording. Raw — never normalised. */
  transcript: string;
  /** The in-flight guess, shown differently because it can still change. */
  interimTranscript: string;
  /** Recognition broke mid-recording. The audio is still fine; this is a notice, not a failure. */
  recognitionFailed: boolean;
  /**
   * Live microphone level, 0..1. MEASURED, not decorative.
   *
   * Stays at 0 for the whole recording when the track is delivering silence,
   * which is the only on-screen warning a student gets before they discover it
   * in playback. 0 also when WebAudio is unavailable — see `hasLevelMeter`.
   */
  inputLevel: number;
  /** Whether `inputLevel` means anything on this engine. False = no measurement, not silence. */
  hasLevelMeter: boolean;
  isRecording: boolean;
  start: () => void;
  stop: () => void;
  /** Discard the recording, transcript and timer, and return to IDLE. */
  retry: () => void;
}

export const useRecorder = ({
  lang = 'en-US',
  maxDurationMs = MAX_RECORDING_MS,
  onBeforeStart,
  transcribeWhileRecording = SPEECH_RECOGNITION_WHILE_RECORDING,
  deviceId = null,
}: UseRecorderOptions = {}): RecorderApi => {
  // Probed once per mount. The answer cannot change while the page is open —
  // permission can, but the presence of the APIs cannot.
  const [support] = useState<RecordingSupport>(() => detectRecordingSupport());

  const [state, setState] = useState<RecorderState>(() =>
    support.canRecord ? 'IDLE' : 'UNSUPPORTED',
  );
  const [errorKind, setErrorKind] = useState<RecordingErrorKind | null>(() =>
    support.canRecord ? null : unsupportedReason(support),
  );

  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recognitionFailed, setRecognitionFailed] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [hasLevelMeter, setHasLevelMeter] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<InputLevelMeter | null>(null);
  /** Length of the take, captured at Stop so `finalize` does not race the state update. */
  const finalDurationRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcribeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const finalTranscriptRef = useRef('');

  // The two outstanding endings. `speechSettled` starts true so a run without
  // recognition (Firefox, or a recogniser that refused to start) finalises the
  // moment the blob lands instead of waiting out the timeout.
  const blobSettledRef = useRef(false);
  const speechSettledRef = useRef(true);
  const finalBlobRef = useRef<Blob | null>(null);
  /**
   * Guards against finishing twice.
   *
   * `finalize` is called from four places — the recorder's stop event,
   * recognition's end event, the timeout and `stop()` itself — precisely
   * because none of them knows whether it is the last one. Without this guard
   * the second caller would mint a second object URL for the same blob.
   */
  const finalizedRef = useRef(false);
  /** Set while WE are tearing down, so our own `track.onended` is not read as revocation. */
  const teardownRef = useRef(false);

  const optionsRef = useRef({
    onBeforeStart,
    maxDurationMs,
    lang,
    transcribeWhileRecording,
    deviceId,
  });
  optionsRef.current = {
    onBeforeStart,
    maxDurationMs,
    lang,
    transcribeWhileRecording,
    deviceId,
  };

  /* ── timers ──────────────────────────────────────────────────────────── */

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearTranscribeTimer = useCallback(() => {
    if (transcribeTimerRef.current !== null) {
      clearTimeout(transcribeTimerRef.current);
      transcribeTimerRef.current = null;
    }
  }, []);

  const releaseUrl = useCallback(() => {
    releaseRecordingUrl(blobUrlRef.current);
    blobUrlRef.current = null;
  }, []);

  /**
   * Close the meter and hand back its verdict.
   *
   * Returns the peak it saw, or null if there was no meter — a distinction the
   * silence check depends on, because "we measured nothing" and "we measured
   * zero" must not lead to the same conclusion.
   */
  const closeMeter = useCallback((): number | null => {
    const meter = meterRef.current;
    meterRef.current = null;
    if (!meter) return null;
    const peak = meter.peak();
    meter.close();
    return peak;
  }, []);

  /**
   * Detach and release every live resource.
   *
   * Ordered deliberately: the recorder's handlers are removed BEFORE it is
   * stopped, so a teardown mid-recording cannot re-enter finalisation and push
   * an unmounted component into RESULT.
   */
  const teardown = useCallback(() => {
    teardownRef.current = true;
    clearTick();
    clearTranscribeTimer();

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // Already inactive on some engines; nothing left to stop.
        }
      }
    }

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        // abort(), not stop(): we are discarding, so a final result would only
        // arrive for a recording that no longer exists.
        recognition.abort();
      } catch {
        // Never started, or already ended.
      }
    }

    closeMeter();
    stopStream(streamRef.current);
    streamRef.current = null;
    teardownRef.current = false;
  }, [clearTick, clearTranscribeTimer, closeMeter]);

  /* ── finishing ───────────────────────────────────────────────────────── */

  const finalize = useCallback(() => {
    if (finalizedRef.current) return;
    if (!blobSettledRef.current || !speechSettledRef.current) return;
    finalizedRef.current = true;
    clearTranscribeTimer();

    // The device is released HERE, not in `stop()`.
    //
    // It used to be released the moment Stop was pressed, on the reasoning
    // that a lit microphone indicator during "Finishing…" reads as still
    // listening. That reasoning was right about the symptom and wrong about
    // the timing: `recorder.stop()` is ASYNCHRONOUS, so killing the tracks in
    // the same tick can cut the encoder off before it has written its audio
    // clusters. Chrome then produced a header-only blob. Capture has not
    // ceased until the blob has landed, and this is where that is true.
    const measuredPeak = closeMeter();
    setInputLevel(0);
    stopStream(streamRef.current);
    streamRef.current = null;

    const recorded = finalBlobRef.current;
    if (
      isEmptyRecording(recorded) ||
      (recorded as Blob).size < MIN_PLAUSIBLE_BLOB_BYTES
    ) {
      // A container header with no audio in it is not a recording. Saying so
      // is better than handing over a player that shows 0:00 and freezes, and
      // letting the student blame their microphone for our bug.
      setErrorKind('RECORDER_FAILED');
      setState('ERROR');
      return;
    }

    // Checked AFTER the size test and BEFORE the object URL, because a file of
    // plausible size full of silence is the failure that looks most like
    // success: it plays, it has a duration, and it contains nothing. The size
    // floor above cannot see it. Only the meter can, and only when there was
    // one — `null` means unmeasured, and unmeasured is never a verdict.
    if (measuredPeak === 0 && finalDurationRef.current >= SILENCE_VERDICT_AFTER_MS) {
      setErrorKind('SILENT_CAPTURE');
      setState('ERROR');
      return;
    }

    releaseUrl();
    const url = createRecordingUrl(recorded as Blob);
    blobUrlRef.current = url;
    setBlob(recorded);
    setBlobUrl(url);
    setMimeType((recorded as Blob).type || null);
    setInterimTranscript('');
    setState('RESULT');
  }, [clearTranscribeTimer, closeMeter, releaseUrl]);

  const stop = useCallback(() => {
    if (recorderRef.current === null) return;
    clearTick();
    finalDurationRef.current = Date.now() - startedAtRef.current;
    setDurationMs(finalDurationRef.current);
    setState('TRANSCRIBING');

    // ARMED BEFORE ANYTHING IS STOPPED, because the two endings below can fire
    // synchronously — an engine that flushes its blob and its final result
    // inside stop() would finalise while this timer did not yet exist, and
    // nothing would ever clear it. `finalize` clears it; ordering is what makes
    // that true rather than usually true.
    clearTranscribeTimer();
    transcribeTimerRef.current = setTimeout(() => {
      speechSettledRef.current = true;
      blobSettledRef.current = true;
      finalize();
    }, TRANSCRIBE_TIMEOUT_MS);

    const recorder = recorderRef.current;
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        blobSettledRef.current = true;
      }
    } else {
      blobSettledRef.current = true;
    }

    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        // stop(), not abort(): the final result is still wanted.
        recognition.stop();
      } catch {
        speechSettledRef.current = true;
      }
    }

    // NOTE: the stream is deliberately NOT stopped here — see `finalize`.
    finalize();
  }, [clearTick, clearTranscribeTimer, finalize]);

  // The tick closure is created once per recording but must call the CURRENT
  // stop; a ref keeps that indirection in one place.
  const stopRef = useRef(stop);
  stopRef.current = stop;

  /* ── starting ────────────────────────────────────────────────────────── */

  const start = useCallback(() => {
    if (!support.canRecord) {
      setErrorKind(unsupportedReason(support));
      setState('UNSUPPORTED');
      return;
    }

    // Anything still alive from a previous attempt goes first, so a fast
    // Record -> Record can never leave two recorders on one device.
    teardown();
    releaseUrl();
    chunksRef.current = [];
    finalBlobRef.current = null;
    finalTranscriptRef.current = '';
    blobSettledRef.current = false;
    speechSettledRef.current = true;
    finalizedRef.current = false;
    setBlob(null);
    setBlobUrl(null);
    setMimeType(null);
    setTranscript('');
    setInterimTranscript('');
    setRecognitionFailed(false);
    setDurationMs(null);
    setElapsedMs(0);
    setInputLevel(0);
    setHasLevelMeter(false);
    finalDurationRef.current = 0;
    setErrorKind(null);
    setState('REQUESTING_PERMISSION');

    optionsRef.current.onBeforeStart?.();

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await requestMicrophoneStream(optionsRef.current.deviceId ?? undefined);
      } catch (caught) {
        const kind = classifyMicrophoneError(caught);
        setErrorKind(kind);
        // A denial is its own state because it is the only one the student can
        // fix themselves, and its UI is instructions rather than an apology.
        setState(kind === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'ERROR');
        return;
      }

      streamRef.current = stream;

      // Checked BEFORE the recorder is built, not after the recording is over.
      // A track that is already ended or disabled will produce exactly the
      // silent file this phase exists to prevent, and it costs two property
      // reads to refuse it up front instead of after the student has spoken.
      if (!isTrackUsable(stream)) {
        stopStream(stream);
        streamRef.current = null;
        setErrorKind('DEVICE_CONSTRAINT_UNMET');
        setState('ERROR');
        return;
      }

      // A track ending on its own means the device went away or permission was
      // withdrawn — the one case that cannot be discovered by a return value.
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (teardownRef.current) return;
          teardown();
          releaseUrl();
          setBlob(null);
          setBlobUrl(null);
          setErrorKind('PERMISSION_REVOKED');
          setState('ERROR');
        };
      });

      const choice = pickRecordingMimeType();
      let recorder: MediaRecorder;
      try {
        const Ctor = (window as unknown as { MediaRecorder: typeof MediaRecorder })
          .MediaRecorder;
        recorder = choice.mimeType
          ? new Ctor(stream, { mimeType: choice.mimeType })
          : new Ctor(stream);
      } catch {
        stopStream(stream);
        streamRef.current = null;
        setErrorKind('RECORDER_FAILED');
        setState('ERROR');
        return;
      }

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        finalBlobRef.current = new Blob(chunksRef.current, {
          // The recorder's own type wins; `choice.mimeType` is only what we
          // asked for, and a browser may have recorded something else.
          type: recorder.mimeType || choice.mimeType || '',
        });
        blobSettledRef.current = true;
        finalize();
      };
      recorder.onerror = () => {
        teardown();
        setErrorKind('RECORDER_FAILED');
        setState('ERROR');
      };
      recorderRef.current = recorder;

      // Opened alongside the recorder, on the SAME stream — WebAudio taps a
      // MediaStream without opening the device a second time, which is exactly
      // what SpeechRecognition cannot do and why it is no longer run here.
      meterRef.current = createInputLevelMeter(stream);
      setHasLevelMeter(meterRef.current !== null);

      try {
        // With a timeslice, so audio accumulates during the recording rather
        // than existing only inside the encoder until stop().
        recorder.start(RECORDER_TIMESLICE_MS);
      } catch {
        teardown();
        setErrorKind('RECORDER_FAILED');
        setState('ERROR');
        return;
      }

      // Recognition is best-effort from here on. Every failure below leaves the
      // recording running, because audio is the Phase 3 deliverable and the
      // transcript is the bonus.
      //
      // And on Chrome it does not merely fail — it takes the audio with it. See
      // SPEECH_RECOGNITION_WHILE_RECORDING, which is why this whole branch is
      // gated off rather than deleted.
      const recognition = optionsRef.current.transcribeWhileRecording
        ? createSpeechRecognition(optionsRef.current.lang)
        : null;
      if (recognition) {
        recognition.onresult = (event) => {
          let interim = '';
          let finalAdd = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            const text = result?.[0]?.transcript ?? '';
            if (result?.isFinal) finalAdd += `${text} `;
            else interim += text;
          }
          if (finalAdd.trim()) {
            finalTranscriptRef.current =
              `${finalTranscriptRef.current} ${finalAdd}`.replace(/\s+/g, ' ').trim();
            setTranscript(finalTranscriptRef.current);
          }
          setInterimTranscript(interim.trim());
        };
        recognition.onerror = (event) => {
          // 'no-speech' is not a malfunction — it is a student who did not
          // speak, and the recording of their silence is still valid.
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setRecognitionFailed(true);
          }
        };
        recognition.onend = () => {
          speechSettledRef.current = true;
          setInterimTranscript('');
          finalize();
        };
        try {
          recognition.start();
          recognitionRef.current = recognition;
          speechSettledRef.current = false;
        } catch {
          setRecognitionFailed(true);
          recognitionRef.current = null;
          speechSettledRef.current = true;
        }
      }

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setState('RECORDING');

      clearTick();
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        // Sampling here rather than on an animation frame keeps the meter on
        // the same clock as the timer: one interval, one place to clear it.
        if (meterRef.current) setInputLevel(meterRef.current.read());
        if (elapsed >= optionsRef.current.maxDurationMs) stopRef.current();
      }, RECORDER_TICK_MS);
    })();
  }, [clearTick, finalize, releaseUrl, support, teardown]);

  /* ── discarding ──────────────────────────────────────────────────────── */

  const retry = useCallback(() => {
    teardown();
    releaseUrl();
    chunksRef.current = [];
    finalBlobRef.current = null;
    finalTranscriptRef.current = '';
    blobSettledRef.current = false;
    speechSettledRef.current = true;
    finalizedRef.current = false;
    setBlob(null);
    setBlobUrl(null);
    setMimeType(null);
    setTranscript('');
    setInterimTranscript('');
    setRecognitionFailed(false);
    setElapsedMs(0);
    setInputLevel(0);
    setHasLevelMeter(false);
    finalDurationRef.current = 0;
    setDurationMs(null);
    if (support.canRecord) {
      setErrorKind(null);
      setState('IDLE');
    } else {
      setErrorKind(unsupportedReason(support));
      setState('UNSUPPORTED');
    }
  }, [releaseUrl, support, teardown]);

  /* ── lifetime ────────────────────────────────────────────────────────── */

  // Unmount releases the device, the timers AND the object URL. Navigating away
  // mid-recording is an ordinary thing for a student to do, and none of the
  // three survives it.
  useEffect(
    () => () => {
      teardown();
      releaseRecordingUrl(blobUrlRef.current);
      blobUrlRef.current = null;
    },
    [teardown],
  );

  // Closing the tab while recording loses the audio, and only the browser can
  // ask about that. Registered only while RECORDING so it never interferes with
  // ordinary navigation.
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
    elapsedMs,
    durationMs,
    blob,
    blobUrl,
    mimeType,
    transcript,
    interimTranscript,
    recognitionFailed,
    inputLevel,
    hasLevelMeter,
    isRecording,
    start,
    stop,
    retry,
  };
};
