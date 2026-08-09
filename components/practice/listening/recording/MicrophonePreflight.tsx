import React from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Activity } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import RecordingWaveform from './RecordingWaveform';
import { recordingErrorMessage } from './recordingErrorCopy';
import type { RecordingErrorKind } from './recordingService';
import type { PreflightState } from './useMicrophonePreflight';

// Sprint 11 Phase 3.1 — "say something and let me check I can hear it".
//
// THE FAILURE COPY IS THE POINT OF THIS COMPONENT. Detecting no signal is two
// lines of code; the value is in what a student is told next, because the five
// causes have five different fixes and only one of them is anything the app
// did. In the case this phase came from — a virtual audio device selected by
// the browser — the fix is "choose a different microphone", which is only
// actionable because the chooser is sitting directly above.
//
// THE LEVEL METER IS THE EXISTING RecordingWaveform. It already renders
// measured amplitude from an AnalyserNode, which is exactly what this needs; a
// separate MicrophoneLevelMeter component would be the same thing with a
// different name, and two meters would be two places for the honesty rule
// ("never draw a signal you did not measure") to be broken independently.

interface MicrophonePreflightProps {
  state: PreflightState;
  errorKind: RecordingErrorKind | null;
  level: number;
  /** False when this browser cannot measure — must never be shown as "no signal". */
  measurable: boolean;
  onStart: () => void;
  onChooseAnother: () => void;
  /** True when there is more than one input to move to. */
  canChooseAnother: boolean;
}

const MicrophonePreflight: React.FC<MicrophonePreflightProps> = ({
  state,
  errorKind,
  level,
  measurable,
  onStart,
  onChooseAnother,
  canChooseAnother,
}) => {
  const { t } = useTranslation();

  const actionClass =
    'px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
  const neutralAction = `${actionClass} bg-white dark:bg-[#0F172A] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800`;

  if (state === 'CHECKING') {
    return (
      <div className="space-y-2" data-testid="microphone-preflight">
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300"
        >
          <Loader2 size={13} aria-hidden="true" className="motion-safe:animate-spin" />
          <span>{t.practice.shadowingPreflightChecking}</span>
        </p>
        <RecordingWaveform active level={level} measured />
      </div>
    );
  }

  if (state === 'SIGNAL_DETECTED') {
    return (
      <p
        data-testid="microphone-preflight"
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
      >
        <CheckCircle2 size={13} aria-hidden="true" />
        <span>{t.practice.shadowingPreflightWorking}</span>
      </p>
    );
  }

  if (state === 'NO_SIGNAL' || state === 'DEVICE_ERROR') {
    const headline =
      state === 'DEVICE_ERROR' && errorKind
        ? recordingErrorMessage(t, errorKind)
        : t.practice.shadowingPreflightNoSignal;

    return (
      <div
        data-testid="microphone-preflight"
        role="alert"
        className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/40 space-y-2"
      >
        <p className="flex items-start gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
          <AlertTriangle size={13} aria-hidden="true" className="mt-px shrink-0" />
          <span>{headline}</span>
        </p>

        {/* Ordered by how often each one is the answer, not by how technical
            it sounds. The virtual-device case is third because it is the one a
            student will never guess and the one that shipped this phase. */}
        <ul className="pl-4 space-y-0.5 list-disc text-[11px] font-semibold text-amber-700/90 dark:text-amber-300/90">
          <li>{t.practice.shadowingPreflightHintSpeak}</li>
          <li>{t.practice.shadowingPreflightHintMute}</li>
          <li>{t.practice.shadowingPreflightHintOtherDevice}</li>
          <li>{t.practice.shadowingPreflightHintOtherApp}</li>
          <li>{t.practice.shadowingPreflightHintPermission}</li>
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onStart} className={neutralAction}>
            <Activity size={13} aria-hidden="true" />
            <span>{t.practice.shadowingPreflightRetry}</span>
          </button>
          {canChooseAnother && (
            <button type="button" onClick={onChooseAnother} className={neutralAction}>
              <span>{t.practice.shadowingPreflightChooseAnother}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // IDLE. Two different situations share it, and they are worded apart: the
  // check has not been run yet, or it cannot be run on this browser at all.
  return (
    <div className="space-y-2" data-testid="microphone-preflight">
      {!measurable && (
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">
          {t.practice.shadowingPreflightUnavailable}
        </p>
      )}
      <button type="button" onClick={onStart} className={neutralAction}>
        <Activity size={13} aria-hidden="true" />
        <span>{t.practice.shadowingPreflightAction}</span>
      </button>
    </div>
  );
};

export default MicrophonePreflight;
