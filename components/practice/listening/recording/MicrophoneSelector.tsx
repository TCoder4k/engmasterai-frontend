import React from 'react';
import { Mic, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import type { AudioInputDevice } from './recordingService';

// Sprint 11 Phase 3.1 — which microphone, chosen by the student.
//
// A NATIVE <select>, not a custom listbox. Device names are long, arbitrary,
// vendor-supplied strings ("Microphone (Realtek(R) Audio)", "Voice Changer
// Virtual Audio Device (WDM)"); the platform control already handles truncation,
// keyboard interaction and the phone's native picker, and none of that is worth
// rebuilding for a control most students will touch once.
//
// LABELLED, NOT PLACEHOLDER-LABELLED. `htmlFor` on a real <label>, because a
// student who cannot see the control still has to know what it chooses.
//
// NO deviceId IS EVER RENDERED. It is a per-origin hardware identifier and a
// meaningless string to a reader; it lives in the option's `value` only.

interface MicrophoneSelectorProps {
  devices: AudioInputDevice[];
  selectedId: string | null;
  onSelect: (deviceId: string) => void;
  onRefresh: () => void;
  /** Disabled during capture — swapping the input mid-recording is not supported. */
  disabled?: boolean;
  /**
   * Sprint 11 Phase 3.3 — one row instead of a labelled block: icon + "Micro"
   * inline to the left of the select, no separate label line above it. Used
   * by the compact Shadowing workspace, where the picker sits directly above
   * the Record button rather than inside its own card.
   */
  compact?: boolean;
}

const SELECT_ID = 'shadowing-microphone-select';

const MicrophoneSelector: React.FC<MicrophoneSelectorProps> = ({
  devices,
  selectedId,
  onSelect,
  onRefresh,
  disabled = false,
  compact = false,
}) => {
  const { t } = useTranslation();

  // One input is not a choice. Showing a chooser with a single entry on a
  // phone would be a control that cannot do anything — the device is still
  // named below, which is the part that carries information.
  if (devices.length === 0) return null;

  const select = (
    <select
      id={SELECT_ID}
      value={selectedId ?? ''}
      disabled={disabled || devices.length === 1}
      onChange={(event) => onSelect(event.target.value)}
      className={`w-full py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-bold truncate disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        compact ? 'pl-3 pr-3' : 'pl-8 pr-3'
      }`}
    >
      {selectedId === null && (
        <option value="">{t.practice.shadowingMicrophoneChoose}</option>
      )}
      {devices.map((device) => (
        <option key={device.deviceId} value={device.deviceId}>
          {device.isSystemDefault
            ? `${device.label} — ${t.practice.shadowingMicrophoneSystemDefault}`
            : device.label}
        </option>
      ))}
    </select>
  );

  const refreshButton = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={disabled}
      aria-label={t.practice.shadowingMicrophoneRefresh}
      title={t.practice.shadowingMicrophoneRefresh}
      className="px-3 py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-[#0F172A] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <RefreshCw size={14} aria-hidden="true" />
    </button>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <label
          htmlFor={SELECT_ID}
          className="flex items-center gap-1.5 shrink-0 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-500"
        >
          <Mic size={14} aria-hidden="true" className="text-blue-600 dark:text-[#00A3FF]" />
          <span>{t.practice.shadowingMicrophoneLabel}</span>
        </label>
        <div className="flex-1 min-w-0">{select}</div>
        {refreshButton}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={SELECT_ID}
        className="block text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-500"
      >
        {t.practice.shadowingMicrophoneLabel}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Mic
            size={14}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-[#00A3FF] pointer-events-none"
          />
          {select}
        </div>
        {refreshButton}
      </div>
    </div>
  );
};

export default MicrophoneSelector;
