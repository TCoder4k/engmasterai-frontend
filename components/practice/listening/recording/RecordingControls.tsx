import React, { useId } from 'react';
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
//
// Sprint 11 Phase 4C added the `circle` variant — the large round mic control.
// IT IS A VARIANT, NOT A SECOND COMPONENT: the state machine that decides which
// verb is offered is the part that must never exist in two copies, and a
// separate "big record button" file would have had to reimplement all of it.
// Only the presentation branches.

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
  /** `circle` is the Phase 4C workspace; `inline` is the original compact row. */
  variant?: 'inline' | 'circle';
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  state,
  onStart,
  onStop,
  onRetry,
  disabled = false,
  variant = 'inline',
}) => {
  const { t } = useTranslation();
  const hintId = useId();

  if (state === 'PERMISSION_DENIED' || state === 'UNSUPPORTED') return null;

  const inlineClass =
    'px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
  const inlineSecondaryClass =
    'px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

  /**
   * What is offered right now, in one place.
   *
   * RESULT and ERROR share a verb — in both cases the only thing left to do is
   * record again — but ERROR keeps the neutral styling so a failure does not
   * look like an invitation.
   */
  const action = (() => {
    switch (state) {
      case 'RECORDING':
        return {
          verb: t.practice.shadowingStopAction,
          hint: t.practice.shadowingStopHint,
          icon: <Square size={14} aria-hidden="true" />,
          circleIcon: <Square size={22} aria-hidden="true" />,
          onClick: onStop,
          busy: false,
          inlineTone: 'bg-rose-500 text-white hover:opacity-90',
          circleTone: 'bg-rose-500 text-white',
        };
      case 'REQUESTING_PERMISSION':
      case 'TRANSCRIBING':
        return {
          verb:
            state === 'TRANSCRIBING'
              ? t.practice.shadowingStateTranscribing
              : t.practice.shadowingStateRequesting,
          hint: null,
          icon: (
            <Loader2 size={14} aria-hidden="true" className="motion-safe:animate-spin" />
          ),
          circleIcon: (
            <Loader2 size={22} aria-hidden="true" className="motion-safe:animate-spin" />
          ),
          onClick: undefined,
          busy: true,
          inlineTone: 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
          circleTone: 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
        };
      case 'RESULT':
      case 'ERROR':
        return {
          verb: t.practice.shadowingRetryAction,
          hint: t.practice.shadowingRetryHint,
          icon: <RefreshCw size={14} aria-hidden="true" />,
          circleIcon: <RefreshCw size={22} aria-hidden="true" />,
          onClick: onRetry,
          busy: false,
          inlineTone: null,
          circleTone: 'bg-blue-500 dark:bg-[#00A3FF] text-white',
        };
      default:
        return {
          verb: t.practice.shadowingRecordAction,
          hint: t.practice.shadowingRecordHint,
          icon: <Mic size={14} aria-hidden="true" />,
          circleIcon: <Mic size={26} aria-hidden="true" />,
          onClick: onStart,
          busy: false,
          inlineTone: 'bg-gradient-to-r from-rose-500 to-red-500 text-white hover:opacity-90',
          circleTone: 'bg-blue-500 dark:bg-[#00A3FF] text-white shadow-lg shadow-blue-500/30 dark:shadow-[#00A3FF]/30',
        };
    }
  })();

  // Only the IDLE start is gated by setup. Stop must always be reachable, and
  // "record again" is a reset that cannot fail.
  const isDisabled = action.busy || (state === 'IDLE' && disabled);

  if (variant === 'circle') {
    return (
      <button
        type="button"
        onClick={action.onClick}
        disabled={isDisabled}
        // THE ACCESSIBLE NAME IS THE VERB ALONE. The hint below is `aria-hidden`
        // and reached through `aria-describedby`, because folding it into the
        // name would announce "Record again Record your pronunciation again" —
        // and would break every caller that looks the button up by its verb.
        aria-describedby={action.hint ? hintId : undefined}
        className={`w-full flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed ${
          isDisabled
            ? 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B132B]/60'
            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0B132B] hover:border-slate-200 dark:hover:border-slate-700'
        }`}
      >
        <span
          className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center ${action.circleTone} ${
            state === 'RECORDING' ? 'motion-safe:animate-pulse' : ''
          }`}
        >
          {action.circleIcon}
        </span>
        <span className="min-w-0">
          <span className="block text-base font-extrabold text-slate-900 dark:text-white">
            {action.verb}
          </span>
          {action.hint && (
            <span
              id={hintId}
              aria-hidden="true"
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5"
            >
              {action.hint}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={action.onClick}
        disabled={isDisabled}
        className={
          action.inlineTone === null
            ? inlineSecondaryClass
            : `${inlineClass} ${action.inlineTone}`
        }
      >
        {action.icon}
        <span>{action.verb}</span>
      </button>
    </div>
  );
};

export default RecordingControls;
