import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Mic, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import EmptyState from '../../shared/EmptyState';
import ShadowingHeaderBar from './ShadowingHeaderBar';
import ShadowingReferenceCard from './ShadowingReferenceCard';
import ListeningSessionSummary from './ListeningSessionSummary';
import MicrophonePreflight from './recording/MicrophonePreflight';
import MicrophoneSelector from './recording/MicrophoneSelector';
import RecordingControls from './recording/RecordingControls';
import RecordingPermissionDialog from './recording/RecordingPermissionDialog';
import RecordingPlayback from './recording/RecordingPlayback';
import RecordingStatusIndicator from './recording/RecordingStatusIndicator';
import RecordingWaveform from './recording/RecordingWaveform';
import { isPermissionKind } from './recording/recordingErrorCopy';
import { useMicrophones } from './recording/useMicrophones';
import { useMicrophonePreflight } from './recording/useMicrophonePreflight';
import { authService } from '../../../services/authService';
import ShadowingResultPanel from './recording/ShadowingResultPanel';
import AiPronunciationFeedback from './recording/AiPronunciationFeedback';
import { submitShadowingAttempt } from '../../../services/listeningService';
import type { SubmitShadowingAttemptResult } from '../../../services/listeningService';
import { ApiError, AuthExpiredError } from '../../../services/apiError';
import {
  useRecorder,
  MAX_RECORDING_MS,
  SILENCE_VERDICT_AFTER_MS,
  SPEECH_RECOGNITION_WHILE_RECORDING,
} from './recording/useRecorder';
import { useListeningContent } from './ListeningContentPage';
import { useTranslation } from '../../../i18n/useTranslation';
import { useAssistantLock } from '../../shared/assistant/useAssistant';

// Sprint 11 Phase 3 — Shadowing's RECORDING layer. Not Shadowing itself.
//
// WHAT A STUDENT CAN DO HERE: pick a sentence, hear it, record themselves say
// it, play their recording back, record again, and read the raw transcript the
// browser produced. That is the whole feature.
//
// WHAT IS DELIBERATELY ABSENT, and must stay absent until it is earned: there
// is no comparison between the transcript and the sentence, no accuracy, no
// pass/fail, no XP, no attempt row, no upload and nothing written to the
// account. The transcript is displayed exactly as the browser emitted it. It is
// worth being blunt about why: the moment this panel renders a number next to a
// student's speech, that number is a judgement, and a judgement computed on the
// client from an untrusted transcript is one this codebase does not make. Phase
// 4B moves that decision to the server, where it belongs.
//
// The page says all of this to the student too, in `shadowingLocalOnlyNote` —
// a recording feature that is silent about what happens to the audio invites
// the worst assumption.
//
// THE TRANSCRIPT IS CURRENTLY OFF, and that is a deliberate retreat rather than
// an oversight. Browser QA found that running SpeechRecognition alongside
// MediaRecorder makes Chrome record silence; see
// SPEECH_RECOGNITION_WHILE_RECORDING for the measurement. The panel below still
// knows how to render a transcript, and the constant is what turns it back on,
// so the code path does not have to be rediscovered in Phase 4B.

/**
 * Whether opening the microphone silences the player.
 *
 * TRUE, and as of the Phase 3 browser QA (2026-08-06) this is a MEASURED
 * result rather than a cautious default. Blocker B6 was answered by recording
 * with the video playing and listening to the playback: **the video's audio
 * bleeds into the recording.** Leaving the player running would therefore hand
 * a student a recording of the narrator talking over them — and, in Phase 4B,
 * feed the narrator's words into the transcript that gets graded.
 *
 * So this is no longer a flag waiting on evidence. Do not flip it without a
 * new measurement that contradicts the one above; the honest alternative is
 * not "resume playback", it is echo cancellation or headphones.
 */
export const PAUSE_MEDIA_WHILE_RECORDING = true;

interface ShadowingSessionResult {
  totalSegments: number;
  assistedCount: number;
  wordsCorrect: number;
  wordsTotal: number;
  elapsedSeconds: number;
}

const ShadowingModePanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    content,
    currentIndex,
    replaySegment,
    pauseMedia,
    mediaAvailable,
    goToSegmentAndPlay,
    shadowingCompletedSegmentIds,
    setShadowingCompletedSegmentIds,
  } = useListeningContent();

  const segments = content.segments;
  const segment = segments[currentIndex];

  const pauseMediaRef = useRef(pauseMedia);
  pauseMediaRef.current = pauseMedia;

  const handleBeforeStart = useCallback(() => {
    if (PAUSE_MEDIA_WHILE_RECORDING) pauseMediaRef.current();
  }, []);

  // Read once. The preference key is per-user, and an id that changed under a
  // mounted panel would only mean a logout — which unmounts this anyway.
  const [userId] = useState(() => authService.getUser()?.id ?? '');

  // Sprint 11 Phase 4C — saved sentences, SESSION-ONLY and honestly labelled,
  // exactly as Dictation has them. There is no endpoint behind this in either
  // mode; the tooltip on the button is what keeps that from being a broken
  // promise. Held here rather than in the header bar so it survives the student
  // moving between sentences and back.
  const [savedSegmentIds, setSavedSegmentIds] = useState<Set<string>>(new Set());
  const toggleSavedSegment = useCallback((id: string) => {
    setSavedSegmentIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Phase 4B — the submitted verdict. Server-owned: this component stores what
  // it was told and derives nothing from it.
  const [result, setResult] = useState<SubmitShadowingAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Generated ONCE per recording, not per click. A retry after a timeout must
  // carry the same key so the server replays its original verdict instead of
  // paying for — and possibly disagreeing with — a second transcription.
  const attemptIdRef = useRef<string | null>(null);
  // One-shot per recording, so the auto-submit effect below fires exactly
  // once for a given take and never re-fires after a failure — a failed
  // submission still requires the student's own "Try again" click.
  const autoSubmitFiredRef = useRef(false);
  const microphones = useMicrophones(userId);
  // Sprint 11 Phase 3.3 — kept for an OPTIONAL, manual "test my microphone"
  // action only (see the mic row below). Nothing here gates Record anymore;
  // see PAUSE_MEDIA_WHILE_RECORDING and `onBeforeStart` below for why.
  const preflight = useMicrophonePreflight(microphones.selected?.deviceId ?? null);

  const recorder = useRecorder({
    deviceId: microphones.selected?.deviceId ?? null,
    // Runs after the gesture, before the permission prompt — pausing lesson
    // media here, not inside a wrapper around `recorder.start`, is what lets
    // Record stay a single direct call with nothing blocking in front of it.
    onBeforeStart: handleBeforeStart,
  });

  // Changing sentence discards the recording. Keeping it would leave a student
  // on sentence 4 listening to themselves read sentence 2, with nothing on
  // screen saying which was which — and `retry` is exactly the reset that
  // wants: it stops any live capture, releases the device and revokes the
  // object URL.
  const { retry } = recorder;
  const segmentId = segment?.id;
  const previousSegmentIdRef = useRef(segmentId);
  useEffect(() => {
    if (previousSegmentIdRef.current === segmentId) return;
    previousSegmentIdRef.current = segmentId;
    retry();
  }, [segmentId, retry]);

  // The selected microphone disappearing mid-recording is the one device
  // change that cannot be deferred: the take is already ruined, and letting it
  // run to its own end would hand the student a file recorded on nothing.
  // `retry` is the full teardown — capture, device, analyser, timers, URL.
  const { isRecording, retry: recorderRetry } = recorder;
  const selectedDeviceId = microphones.selected?.deviceId ?? null;
  useEffect(() => {
    if (isRecording && selectedDeviceId === null) recorderRetry();
  }, [isRecording, selectedDeviceId, recorderRetry]);

  // UX precaution, not assessment integrity (Engy stays fully available
  // during graded stages by product decision — see docs/CLAUDE.md): hides
  // the assistant launcher while actively recording so its round trigger
  // never competes with this panel's own round mic button in the same
  // corner. Reappears the moment recording stops.
  useAssistantLock({ active: isRecording, reason: 'uxRecording' });

  // A new take invalidates the previous verdict AND its idempotency key. Both
  // must reset together: keeping the key would make the second recording
  // replay the first one's score, and keeping the result would leave a verdict
  // on screen that belongs to audio the student has already discarded.
  const recordingUrl = recorder.blobUrl;
  const previousUrlRef = useRef(recordingUrl);
  useEffect(() => {
    if (previousUrlRef.current === recordingUrl) return;
    previousUrlRef.current = recordingUrl;
    setResult(null);
    setSubmitError(null);
    attemptIdRef.current = null;
    autoSubmitFiredRef.current = false;
  }, [recordingUrl]);

  // Changing sentence clears the verdict too — for the same reason it clears
  // the recording.
  useEffect(() => {
    setResult(null);
    setSubmitError(null);
    attemptIdRef.current = null;
    autoSubmitFiredRef.current = false;
  }, [segmentId]);

  // Sprint 11 Phase 3.4 — the session's own scoreboard, kept apart from the
  // server's per-segment progress. Best attempt PER SEGMENT, replaced (never
  // summed) on every successful submit, matching the server's own
  // `bestAccuracyPercent` semantics (shadowing.service.ts — "practising again
  // can only raise this"). Accumulating every attempt instead would let a
  // student who went 3/10 -> 6/10 -> 10/10 PASS on one sentence see 19/30 in
  // the session summary instead of the 10/10 they actually finished with.
  const bestBySegmentRef = useRef(
    new Map<string, { wordsCorrect: number; wordsTotal: number; accuracyPercent: number }>(),
  );
  const startedAtRef = useRef(Date.now());
  const [sessionResult, setSessionResult] = useState<ShadowingSessionResult | null>(null);

  const recordedBlob = recorder.blob;
  const recordedDurationMs = recorder.durationMs;
  const handleSubmit = useCallback(async () => {
    if (!segmentId || !recordedBlob) return;
    setSubmitting(true);
    setSubmitError(null);
    // Reused across retries on purpose — see attemptIdRef.
    attemptIdRef.current ??= crypto.randomUUID();
    try {
      const verdict = await submitShadowingAttempt(segmentId, {
        clientAttemptId: attemptIdRef.current,
        audio: recordedBlob,
        durationMs: recordedDurationMs ?? undefined,
      });
      setResult(verdict);

      // Best-attempt bookkeeping for this session's summary — every
      // successful submit is compared, not just a passing one.
      const existing = bestBySegmentRef.current.get(segmentId);
      if (!existing || verdict.accuracyPercent >= existing.accuracyPercent) {
        bestBySegmentRef.current.set(segmentId, {
          wordsCorrect: verdict.wordsCorrect,
          wordsTotal: verdict.wordsTotal,
          accuracyPercent: verdict.accuracyPercent,
        });
      }

      // Completion is earned, never merely attempted — a failed or retaken
      // segment must keep being offered by Next until it actually passes.
      if (verdict.passed) {
        setShadowingCompletedSegmentIds((previous) => new Set(previous).add(segmentId));
      }
    } catch (error) {
      // Each failure gets its own sentence, because the recoveries differ: a
      // 503 means wait, a 400 means record again, a 429 means slow down, and a
      // 401 means sign in. A shared "something went wrong" would send every
      // one of those students to do the wrong thing.
      if (error instanceof AuthExpiredError) {
        setSubmitError(t.practice.shadowingErrorSessionExpired);
      } else if (error instanceof ApiError && error.status === 400) {
        setSubmitError(t.practice.shadowingErrorInvalidAudio);
      } else if (error instanceof ApiError && error.status === 429) {
        setSubmitError(t.practice.shadowingErrorRateLimited);
      } else if (error instanceof ApiError && error.status === 503) {
        setSubmitError(t.practice.shadowingErrorProviderUnavailable);
      } else {
        setSubmitError(t.practice.shadowingErrorUploadFailed);
      }
    } finally {
      setSubmitting(false);
    }
  }, [segmentId, recordedBlob, recordedDurationMs, t, setShadowingCompletedSegmentIds]);

  // Phase 3.2 — SUBMIT IS NO LONGER A SEPARATE CLICK. Stopping the recording
  // is enough; this fires once per take and never again after a failure —
  // that recovery stays the student's own "Try again" press, so a network
  // blip cannot silently repeat a paid call with nothing new to show for it.
  useEffect(() => {
    if (recorder.state !== 'RESULT' || !recorder.blob) return;
    if (result || submitting || submitError) return;
    if (autoSubmitFiredRef.current) return;
    autoSubmitFiredRef.current = true;
    void handleSubmit();
  }, [recorder.state, recorder.blob, result, submitting, submitError, handleSubmit]);

  /**
   * The next segment still to be completed, searching forward and wrapping.
   * `-1` means every segment has actually passed — never merely "reached the
   * last index". Copied from Dictation's identical rule on purpose: a mode is
   * complete only when every segment is, and wrapping is what sends the
   * student back to real remaining work instead of stopping at the end of the
   * list with earlier sentences still outstanding.
   */
  const nextUnsolvedIndex = (completed: Set<string>, fromIndex: number): number => {
    for (let step = 1; step <= segments.length; step++) {
      const candidate = (fromIndex + step) % segments.length;
      if (!completed.has(segments[candidate].id)) return candidate;
    }
    return -1;
  };

  // Stop whatever is audible BEFORE asking the new segment to play anything —
  // both the student's own recording (`retry` tears down the blob URL that
  // backs RecordingPlayback's <audio>) and the lesson media, synchronously,
  // rather than relying on the segment-change effect above to get there in
  // time. Never leaves two sources playing into each other.
  const advanceTo = (index: number) => {
    recorder.retry();
    pauseMedia();
    goToSegmentAndPlay(index);
  };

  const handleNext = () => {
    const target = nextUnsolvedIndex(shadowingCompletedSegmentIds, currentIndex);
    if (target === -1) {
      let wordsCorrect = 0;
      let wordsTotal = 0;
      bestBySegmentRef.current.forEach((entry) => {
        wordsCorrect += entry.wordsCorrect;
        wordsTotal += entry.wordsTotal;
      });
      setSessionResult({
        totalSegments: segments.length,
        // Shadowing has no "assisted" concept — always 0, which is what
        // keeps ListeningSessionSummary's Replay Mistakes button hidden.
        assistedCount: 0,
        wordsCorrect,
        wordsTotal,
        elapsedSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
      });
    } else {
      advanceTo(target);
    }
  };

  const handleReplayLesson = () => {
    setShadowingCompletedSegmentIds(new Set());
    bestBySegmentRef.current.clear();
    startedAtRef.current = Date.now();
    setSessionResult(null);
    advanceTo(0);
  };

  if (segments.length === 0 || !segment) {
    return (
      <EmptyState
        icon={<Headphones size={32} />}
        message={t.practice.listeningNoSegments}
      />
    );
  }

  if (sessionResult) {
    return (
      <ListeningSessionSummary
        title={content.title}
        level={content.level}
        categoryName={content.category.name}
        totalSegments={sessionResult.totalSegments}
        assistedCount={sessionResult.assistedCount}
        wordsCorrect={sessionResult.wordsCorrect}
        wordsTotal={sessionResult.wordsTotal}
        elapsedSeconds={sessionResult.elapsedSeconds}
        onReplayMistakes={handleReplayLesson}
        onReplayLesson={handleReplayLesson}
        onBackToLessons={() => navigate('/practice/listening')}
      />
    );
  }

  const showPermissionSurface =
    isPermissionKind(recorder.errorKind) &&
    (recorder.state === 'PERMISSION_DENIED' ||
      recorder.state === 'UNSUPPORTED' ||
      recorder.state === 'ERROR');

  // Setup must be finished before a recording is worth making. The preflight
  // is not a precondition at all anymore — Record only needs a resolved,
  // selected microphone to be pressable; signal quality is judged live,
  // during the recording itself (see `silentInput` below).
  const microphoneReady = microphones.access === 'READY' && microphones.selected !== null;
  const canRecord = recorder.support.canRecord && microphoneReady;

  const recordBlockedReason = (() => {
    if (!recorder.support.canRecord) return null;
    if (microphones.access !== 'READY') return t.practice.shadowingMicrophoneSetUpAction;
    if (microphones.devices.length === 0) return t.practice.shadowingMicrophoneNone;
    if (!microphoneReady) return t.practice.shadowingMicrophoneChoose;
    return null;
  })();

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#0F172A] border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-4">
        <ShadowingHeaderBar
          segmentNumber={currentIndex + 1}
          wordCount={segment.text.trim().split(/\s+/).filter(Boolean).length}
          isSentenceSaved={savedSegmentIds.has(segment.id)}
          onToggleSaveSentence={() => toggleSavedSegment(segment.id)}
        />

        <ShadowingReferenceCard
          segment={segment}
          onListen={replaySegment}
          listenEnabled={mediaAvailable}
        />
      </div>

      {/* MIC ROW + RECORD + RESULT — one workspace, not three stacked cards.
          The picker and the recorder used to be separate bordered cards with
          their own padding and a gap between; merged here because they are
          always shown together in practice (the mic row only hides once
          RECORDING starts, right below). */}
      <div className="bg-white dark:bg-[#0F172A] border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-3">
        {/* MICROPHONE. Above the recorder, not hidden behind a settings icon:
            the device is the thing that was wrong, and a student who cannot
            see which microphone is in use cannot discover that it is the
            wrong one. Permission is requested from the button here — never on
            mount, because device labels stay blank until it is granted and a
            page that prompts on load is asking before it has a reason to. */}
        {recorder.support.canRecord && recorder.state !== 'RECORDING' && (
          <div className="space-y-2">
            {microphones.access === 'UNKNOWN' && !microphones.detecting && (
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-500">
                  {t.practice.shadowingMicrophoneLabel}
                </p>
                <button
                  type="button"
                  onClick={microphones.requestAccess}
                  className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-[#0B132B] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Mic size={14} aria-hidden="true" className="text-blue-600 dark:text-[#00A3FF]" />
                  <span>{t.practice.shadowingMicrophoneSetUpAction}</span>
                </button>
              </div>
            )}

            {microphones.access === 'REQUESTING' && (
              <p
                role="status"
                aria-live="polite"
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300"
              >
                {t.practice.shadowingStateRequesting}
              </p>
            )}

            {microphones.access === 'BLOCKED' && microphones.errorKind && (
              <RecordingPermissionDialog
                kind={microphones.errorKind}
                onRetry={microphones.requestAccess}
              />
            )}

            {microphones.access === 'READY' && (
              <>
                {/* One row in the common case: icon + label + the selected
                    device, right-aligned. The select itself already shows the
                    current device's name, so a separate "in use" line would
                    just repeat it. */}
                <MicrophoneSelector
                  compact
                  devices={microphones.devices}
                  selectedId={microphones.selected?.deviceId ?? null}
                  onSelect={microphones.select}
                  onRefresh={microphones.refresh}
                />

                {microphones.preferenceWasStale && (
                  <p
                    role="alert"
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400"
                  >
                    {t.practice.shadowingMicrophoneStale}
                  </p>
                )}

                {microphones.enumerated && microphones.devices.length === 0 && (
                  <p
                    role="alert"
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400"
                  >
                    {t.practice.shadowingMicrophoneNone}
                  </p>
                )}

                {/* Sprint 11 Phase 3.3 — OPTIONAL and clearly secondary. Record
                    no longer waits on this; it exists only for a student who
                    wants to check a device before pressing Record, styled as a
                    quiet text link so it never reads as a required step next to
                    the Record button below. */}
                {microphones.selected && (
                  <button
                    type="button"
                    onClick={preflight.start}
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline decoration-dotted underline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                  >
                    {t.practice.shadowingPreflightAction}
                  </button>
                )}
                {microphones.selected && preflight.state !== 'IDLE' && (
                  <MicrophonePreflight
                    state={preflight.state}
                    errorKind={preflight.errorKind}
                    level={preflight.level}
                    measurable={preflight.measurable}
                    onStart={preflight.start}
                    onChooseAnother={microphones.refresh}
                    canChooseAnother={microphones.devices.length > 1}
                  />
                )}
              </>
            )}
          </div>
        )}

        <RecordingStatusIndicator
          state={recorder.state}
          errorKind={recorder.errorKind}
          elapsedMs={recorder.elapsedMs}
          maxDurationMs={MAX_RECORDING_MS}
          recognitionFailed={recorder.recognitionFailed}
          speechSupported={recorder.support.speechRecognition}
          transcriptEnabled={SPEECH_RECOGNITION_WHILE_RECORDING}
          silentInput={
            recorder.isRecording &&
            recorder.hasLevelMeter &&
            recorder.inputLevel === 0 &&
            recorder.elapsedMs >= SILENCE_VERDICT_AFTER_MS
          }
        />

        <RecordingWaveform
          active={recorder.isRecording}
          level={recorder.inputLevel}
          measured={recorder.hasLevelMeter}
        />

        {/* Hidden entirely, not merely disabled, when the microphone is
            blocked: instructions are already on screen above and a Record
            button underneath them only invites another failed press. Every
            other blocked case keeps a visible disabled button, because those
            have a next step the student can reach. */}
        {microphones.access !== 'BLOCKED' && (
          <RecordingControls
            variant="circle"
            state={recorder.state}
            onStart={recorder.start}
            onStop={recorder.stop}
            onRetry={recorder.retry}
            disabled={!canRecord}
          />
        )}

        {/* Sprint 11 Phase 3.2 corrected this sentence. It used to say the
            recording stays local "until you choose to send it" — true when
            Submit was a separate click, false since Stop began sending it
            automatically. A page that contradicts itself the moment a
            student stops recording is worse than one that says nothing. */}
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">
          {t.practice.shadowingLocalOnlyNote}
        </p>

        {/* A disabled button with no explanation is a dead end. This says
            which of the three setup steps is outstanding. */}
        {recordBlockedReason && recorder.state === 'IDLE' && (
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {recordBlockedReason}
          </p>
        )}

        {showPermissionSurface && recorder.errorKind && (
          <RecordingPermissionDialog kind={recorder.errorKind} onRetry={recorder.retry} />
        )}

        {/* THE PLAYER MOVES ONCE A VERDICT EXISTS. Before then it belongs with
            the recorder, where the student is deciding whether the take is
            worth sending; afterwards it belongs under "You said", because the
            transcript and the audio it was made from are one claim and reading
            them apart invites the student to dispute the wrong half. It is the
            same component either way — only its place in the page changes. */}
        {!result && (
          <RecordingPlayback
            url={recorder.blobUrl}
            blob={recorder.blob}
            durationMs={recorder.durationMs}
            mimeType={recorder.mimeType}
          />
        )}

        {/* Sprint 11 Phase 3.2 — SUBMIT IS NO LONGER A CLICK. Stopping is
            enough; the effect above fires the same request this button used
            to. This renders only the in-flight state, not an action — there
            is nothing left here for the student to press. */}
        {recorder.state === 'RESULT' && recorder.blob && !result && submitting && (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300"
          >
            <Loader2 size={14} aria-hidden="true" className="motion-safe:animate-spin" />
            <span>{t.practice.shadowingSubmittingLabel}</span>
          </p>
        )}

        {submitError && (
          <div className="space-y-2" role="alert">
            <p className="flex items-start gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <AlertCircle size={13} aria-hidden="true" className="mt-px shrink-0" />
              <span>{submitError}</span>
            </p>
            {/* The recording is still in hand, so the recovery is one button
                and NOT "record it again". Losing a good take to a network
                blip would be the app's fault charged to the student. */}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-[#0B132B] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t.practice.shadowingRetryUpload}
            </button>
          </div>
        )}

        {result && (
          <ShadowingResultPanel
            result={result}
            playback={
              <RecordingPlayback
                url={recorder.blobUrl}
                blob={recorder.blob}
                durationMs={recorder.durationMs}
                mimeType={recorder.mimeType}
              />
            }
            aiFeedback={
              // KEYED ON THE ATTEMPT. A new take must not leave the previous
              // take's coaching on screen — the component holds its own
              // feedback state, and remounting is what clears it.
              <AiPronunciationFeedback
                key={attemptIdRef.current ?? 'none'}
                segmentId={segment.id}
                clientAttemptId={attemptIdRef.current}
                audio={recorder.blob}
              />
            }
          />
        )}

        {!SPEECH_RECOGNITION_WHILE_RECORDING && (
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">
            {t.practice.shadowingTranscriptDisabled}
          </p>
        )}

        {SPEECH_RECOGNITION_WHILE_RECORDING && recorder.support.speechRecognition && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-1.5">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-500">
              {t.practice.shadowingTranscriptTitle}
            </p>
            <p
              className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-h-[1.5rem]"
              aria-live="polite"
            >
              {recorder.transcript}
              {/* Interim results are styled apart because they can still
                  change — showing a guess as settled text is a small lie that
                  a student notices the moment a word rewrites itself. */}
              {recorder.interimTranscript && (
                <span className="italic text-slate-500 dark:text-slate-500">
                  {recorder.transcript ? ' ' : ''}
                  {recorder.interimTranscript}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Sprint 11 Phase 3.4 — replaces the old listen-and-repeat card. Next
          is never gated on the current segment having passed (Shadowing stays
          practice-at-your-own-pace); only reaching a completion summary is
          gated, and only on every segment actually having passed — see
          `nextUnsolvedIndex`. */}
      <button
        type="button"
        onClick={handleNext}
        className="w-full px-4 py-3 min-h-[44px] rounded-2xl bg-blue-500 dark:bg-[#00A3FF] text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span>{t.practice.listeningNextAction}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default ShadowingModePanel;
