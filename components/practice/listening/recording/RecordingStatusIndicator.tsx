import React from 'react';
import { Mic, MicOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { formatAudioTime } from '../../useAudioPlayback';
import { recordingErrorMessage, isPermissionKind } from './recordingErrorCopy';
import type { RecordingErrorKind } from './recordingService';
import type { RecorderState } from './useRecorder';

// Sprint 11 Phase 3 — what the microphone is doing, in words.
//
// THE LIVE REGION IS HERE AND NOWHERE ELSE. Recording state changes without any
// visual the student is looking at (they are reading a sentence, not watching a
// button), so it is announced. `polite` rather than `assertive`: none of these
// transitions is an emergency, and interrupting someone mid-sentence to tell
// them recording started is worse than telling them a moment later.
//
// The elapsed time is NOT inside the live region. It changes five times a
// second; announcing it would make the region useless for everything else.

interface RecordingStatusIndicatorProps {
  state: RecorderState;
  errorKind: RecordingErrorKind | null;
  elapsedMs: number;
  maxDurationMs: number;
  /** Recognition broke but audio survived — a notice, never an error surface. */
  recognitionFailed: boolean;
  /** The engine has no Web Speech API at all. Firefox, today. */
  speechSupported: boolean;
  /**
   * Whether live transcription runs at all in this build.
   *
   * False since the Chrome fix, and both speech notices below are suppressed
   * when it is: telling a Firefox user their browser cannot transcribe implies
   * some other browser would, and right now none of them do it here.
   */
  transcriptEnabled: boolean;
  /** The meter has seen nothing but silence for long enough to be worth saying. */
  silentInput: boolean;
}

const RecordingStatusIndicator: React.FC<RecordingStatusIndicatorProps> = ({
  state,
  errorKind,
  elapsedMs,
  maxDurationMs,
  recognitionFailed,
  speechSupported,
  transcriptEnabled,
  silentInput,
}) => {
  const { t } = useTranslation();

  const recording = state === 'RECORDING';
  const busy = state === 'REQUESTING_PERMISSION' || state === 'TRANSCRIBING';

  const label = (() => {
    switch (state) {
      case 'REQUESTING_PERMISSION':
        return t.practice.shadowingStateRequesting;
      case 'RECORDING':
        return t.practice.shadowingStateRecording;
      case 'TRANSCRIBING':
        return t.practice.shadowingStateTranscribing;
      case 'RESULT':
        return t.practice.shadowingStateResult;
      case 'PERMISSION_DENIED':
      case 'UNSUPPORTED':
      case 'ERROR':
        return t.practice.shadowingStateError;
      case 'IDLE':
      default:
        return t.practice.shadowingStateIdle;
    }
  })();

  const icon = (() => {
    if (recording) return <Mic size={15} aria-hidden="true" />;
    if (busy) return <Loader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" />;
    if (state === 'RESULT') return <CheckCircle2 size={15} aria-hidden="true" />;
    if (state === 'IDLE') return <Mic size={15} aria-hidden="true" />;
    return <MicOff size={15} aria-hidden="true" />;
  })();

  const tone = (() => {
    if (recording)
      return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/40';
    if (state === 'RESULT')
      return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40';
    if (state === 'ERROR' || state === 'PERMISSION_DENIED' || state === 'UNSUPPORTED')
      return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/40';
    return 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-slate-800';
  })();

  // Errors whose fix is a browser setting are rendered by
  // RecordingPermissionDialog instead, so they are not repeated here.
  const inlineError =
    errorKind && !isPermissionKind(errorKind) ? recordingErrorMessage(t, errorKind) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${tone}`}
        >
          {icon}
          <span>{label}</span>
        </span>

        {(recording || state === 'TRANSCRIBING' || state === 'RESULT') && (
          <span
            className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400"
            aria-label={t.practice.shadowingRecordingTimer}
          >
            {formatAudioTime(elapsedMs / 1000)} / {formatAudioTime(maxDurationMs / 1000)}
          </span>
        )}
      </div>

      {/* Announced; the timer above deliberately is not. Test id because
          Phase 3.1 added a second live region (the preflight verdict), and a
          bare `getByRole('status')` can no longer name this one. */}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="recorder-status"
      >
        {label}
      </p>

      {inlineError && (
        <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          <AlertCircle size={13} aria-hidden="true" className="mt-px shrink-0" />
          <span>{inlineError}</span>
        </p>
      )}

      {/* Said DURING the recording, not after it. A student who is told at the
          end that nothing was captured has already read the sentence aloud for
          nothing; the whole value of measuring the input is that this can
          appear while there is still time to fix it. `assertive` because it is
          the one recording notice that is time-critical. */}
      {silentInput && (
        <p
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400"
        >
          <AlertCircle size={13} aria-hidden="true" className="mt-px shrink-0" />
          <span>{t.practice.shadowingSilenceWarning}</span>
        </p>
      )}

      {/* Two different facts, deliberately worded apart: the browser never had
          speech recognition, versus it had it and it broke this time. */}
      {transcriptEnabled && !speechSupported && (
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">
          {t.practice.shadowingSpeechUnsupported}
        </p>
      )}
      {transcriptEnabled && speechSupported && recognitionFailed && (
        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          {t.practice.shadowingRecognitionFailed}
        </p>
      )}
    </div>
  );
};

export default RecordingStatusIndicator;
