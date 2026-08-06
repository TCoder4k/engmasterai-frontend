import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, Volume2, Mic } from 'lucide-react';
import EmptyState from '../../shared/EmptyState';
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
import {
  useRecorder,
  MAX_RECORDING_MS,
  SILENCE_VERDICT_AFTER_MS,
  SPEECH_RECOGNITION_WHILE_RECORDING,
} from './recording/useRecorder';
import { useListeningContent } from './ListeningContentPage';
import { useTranslation } from '../../../i18n/useTranslation';

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

const ShadowingModePanel: React.FC = () => {
  const { t } = useTranslation();
  const { content, currentIndex, replaySegment, pauseMedia, mediaAvailable } =
    useListeningContent();

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
  const microphones = useMicrophones(userId);
  const preflight = useMicrophonePreflight(microphones.selected?.deviceId ?? null);

  const recorder = useRecorder({
    onBeforeStart: handleBeforeStart,
    deviceId: microphones.selected?.deviceId ?? null,
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

  if (segments.length === 0 || !segment) {
    return (
      <EmptyState
        icon={<Headphones size={32} />}
        message={t.practice.listeningNoSegments}
      />
    );
  }

  const showPermissionSurface =
    isPermissionKind(recorder.errorKind) &&
    (recorder.state === 'PERMISSION_DENIED' ||
      recorder.state === 'UNSUPPORTED' ||
      recorder.state === 'ERROR');

  // Setup must be finished before a recording is worth making. The one
  // exception is a browser that cannot measure at all: gating on a check that
  // physically cannot run would lock those students out of the feature over a
  // verdict nobody ever reached.
  const microphoneReady = microphones.access === 'READY' && microphones.selected !== null;
  const preflightSettled =
    preflight.state === 'SIGNAL_DETECTED' || !preflight.measurable;
  const canRecord = recorder.support.canRecord && microphoneReady && preflightSettled;

  const recordBlockedReason = (() => {
    if (!recorder.support.canRecord) return null;
    if (microphones.access !== 'READY') return t.practice.shadowingMicrophoneSetUpAction;
    if (microphones.devices.length === 0) return t.practice.shadowingMicrophoneNone;
    if (!microphoneReady) return t.practice.shadowingMicrophoneChoose;
    if (!preflightSettled) return t.practice.shadowingPreflightRequired;
    return null;
  })();

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t.practice.shadowingReferenceTitle}
          </p>
          {/* The sentence is SHOWN here, unlike Dictation where it is the
              answer. Reading it aloud is the exercise. */}
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
            {segment.text}
          </p>
          {segment.ipa && (
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              /{segment.ipa}/
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={replaySegment}
          disabled={!mediaAvailable}
          className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Volume2 size={14} aria-hidden="true" />
          <span>{t.practice.shadowingListenAction}</span>
        </button>
      </div>

      {/* MICROPHONE SETUP. Above the recorder, not hidden behind a settings
          icon: the device is the thing that was wrong, and a student who
          cannot see which microphone is in use cannot discover that it is the
          wrong one. Permission is requested from the button here — never on
          mount, because device labels stay blank until it is granted and a
          page that prompts on load is asking before it has a reason to. */}
      {recorder.support.canRecord && recorder.state !== 'RECORDING' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-3">
          {microphones.access === 'UNKNOWN' && (
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {t.practice.shadowingMicrophoneLabel}
              </p>
              <button
                type="button"
                onClick={microphones.requestAccess}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Mic size={14} aria-hidden="true" />
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
              <MicrophoneSelector
                devices={microphones.devices}
                selectedId={microphones.selected?.deviceId ?? null}
                onSelect={microphones.select}
                onRefresh={microphones.refresh}
              />

              {/* Stated even when there is only one input, which is why this
                  is not folded into the selector: on a phone the chooser is
                  hidden and this line is the only thing that names the device. */}
              {microphones.selected && (
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t.practice.shadowingMicrophoneInUse}:{' '}
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {microphones.selected.label}
                  </span>
                </p>
              )}

              {microphones.preferenceWasStale && (
                <p
                  role="alert"
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-400"
                >
                  {t.practice.shadowingMicrophoneStale}
                </p>
              )}

              {microphones.enumerated && microphones.devices.length === 0 && (
                <p
                  role="alert"
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-400"
                >
                  {t.practice.shadowingMicrophoneNone}
                </p>
              )}

              {microphones.selected && (
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

      <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-3">
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
            state={recorder.state}
            onStart={recorder.start}
            onStop={recorder.stop}
            onRetry={recorder.retry}
            disabled={!canRecord}
          />
        )}

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

        <RecordingPlayback
          url={recorder.blobUrl}
          blob={recorder.blob}
          durationMs={recorder.durationMs}
          mimeType={recorder.mimeType}
        />

        {!SPEECH_RECOGNITION_WHILE_RECORDING && (
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {t.practice.shadowingTranscriptDisabled}
          </p>
        )}

        {SPEECH_RECOGNITION_WHILE_RECORDING && recorder.support.speechRecognition && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t.practice.shadowingTranscriptTitle}
            </p>
            <p
              className="text-sm font-semibold text-slate-800 dark:text-slate-200 min-h-[1.5rem]"
              aria-live="polite"
            >
              {recorder.transcript}
              {/* Interim results are styled apart because they can still
                  change — showing a guess as settled text is a small lie that
                  a student notices the moment a word rewrites itself. */}
              {recorder.interimTranscript && (
                <span className="italic text-slate-400 dark:text-slate-500">
                  {recorder.transcript ? ' ' : ''}
                  {recorder.interimTranscript}
                </span>
              )}
              {!recorder.transcript &&
                !recorder.interimTranscript &&
                recorder.state === 'RESULT' && (
                  <span className="font-medium text-slate-400 dark:text-slate-500">
                    {t.practice.shadowingTranscriptEmpty}
                  </span>
                )}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {t.practice.shadowingTranscriptDisclaimer}
            </p>
          </div>
        )}

        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {t.practice.shadowingLocalOnlyNote} {t.practice.shadowingMaxDurationNote}
        </p>
      </div>
    </div>
  );
};

export default ShadowingModePanel;
