import React from 'react';
import { Mic, Square, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import type { RecorderState } from './useRecorder';

// Sprint 11 Phase 3 — Record / Stop / Record again.
//
// ONE PRIMARY BUTTON AT A TIME. The state decides which verb is offered, so
// there is never a Stop next to a Record for the student to choose wrongly
// between. This is the same discipline Dictation's single Next control follows,
// and for the same reason: a second way to do the thing is a second way to get
// it wrong.
//
// REAL <button>s WITH REAL LABELS. Not an icon-only toggle — "the round red one"
// is not a name, and the difference between arming and disarming a microphone
// is exactly the thing that must not depend on recognising a glyph. Targets are
// 44px so they are usable on a phone held in one hand.
//
// NO PERMISSION-DENIED OR UNSUPPORTED BRANCH HERE. Those render nothing at all,
// because RecordingPermissionDialog is already saying what to do and a dead
// Record button underneath it would just invite another failed press.

interface RecordingControlsProps {
  state: RecorderState;
  /** Recording needs a user gesture; every callback below is bound to a click. */
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
  /**
   * Recording is not allowed yet — no microphone chosen, or it has not proved
   * it can hear anything. Rendered as a disabled button rather than a hidden
   * one so the student can see what they are working towards; the reason is
   * stated next to it by the caller.
   */
  disabled?: boolean;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  state,
  onStart,
  onStop,
  onRetry,
  disabled = false,
}) => {
  const { t } = useTranslation();

  if (state === 'PERMISSION_DENIED' || state === 'UNSUPPORTED') return null;

  const primaryClass =
    'px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
  const secondaryClass =
    'px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

  if (state === 'RECORDING') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onStop}
          className={`${primaryClass} bg-rose-500 text-white hover:opacity-90`}
        >
          <Square size={14} aria-hidden="true" />
          <span>{t.practice.shadowingStopAction}</span>
        </button>
      </div>
    );
  }

  if (state === 'REQUESTING_PERMISSION' || state === 'TRANSCRIBING') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled
          className={`${primaryClass} bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400`}
        >
          <Loader2 size={14} aria-hidden="true" className="motion-safe:animate-spin" />
          <span>
            {state === 'TRANSCRIBING'
              ? t.practice.shadowingStateTranscribing
              : t.practice.shadowingStateRequesting}
          </span>
        </button>
      </div>
    );
  }

  // RESULT and ERROR share a verb — in both cases the only thing left to do is
  // record again — but ERROR keeps the neutral styling so a failure does not
  // look like an invitation.
  if (state === 'RESULT' || state === 'ERROR') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onRetry} className={secondaryClass}>
          <RefreshCw size={14} aria-hidden="true" />
          <span>{t.practice.shadowingRetryAction}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className={`${primaryClass} bg-gradient-to-r from-rose-500 to-red-500 text-white hover:opacity-90`}
      >
        <Mic size={14} aria-hidden="true" />
        <span>{t.practice.shadowingRecordAction}</span>
      </button>
    </div>
  );
};

export default RecordingControls;
