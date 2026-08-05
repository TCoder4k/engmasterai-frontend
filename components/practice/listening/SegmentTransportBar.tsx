import React from 'react';
import { Play, Pause, RotateCcw, Repeat } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

// Sprint 11 Phase 2 — the controls that act on the CURRENT sentence.
//
// PROVIDER-BLIND. Every prop is a plain value or callback; the bar cannot tell
// a YouTube iframe from an <audio> element, which is what lets one set of
// controls serve both.
//
// THE SPEED MENU IS BUILT FROM REAL CAPABILITY. `availableRates` comes from
// the provider (`getAvailablePlaybackRates()` for YouTube), never from a
// hardcoded list — YouTube's own available rates differ by video and client,
// and offering a rate the player will refuse produces a control that silently
// does nothing.
//
// EVERY CONTROL DISABLES AS ONE when no media is playable, instead of throwing
// on a null controller. A dead-but-clickable transport is how a broken video
// turns into "the app is broken".

interface SegmentTransportBarProps {
  isPlaying: boolean;
  disabled: boolean;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  playbackRate: number;
  availableRates: number[];
  onPlaybackRateChange: (rate: number) => void;
  onPlayPause: () => void;
  onReplay: () => void;
}

const SegmentTransportBar: React.FC<SegmentTransportBarProps> = ({
  isPlaying,
  disabled,
  loop,
  onLoopChange,
  playbackRate,
  availableRates,
  onPlaybackRateChange,
  onPlayPause,
  onReplay,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        aria-label={isPlaying ? t.practice.listeningPause : t.practice.listeningPlay}
        className="px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {isPlaying ? (
          <Pause size={15} aria-hidden="true" />
        ) : (
          <Play size={15} aria-hidden="true" />
        )}
        <span>{isPlaying ? t.practice.listeningPause : t.practice.listeningPlay}</span>
      </button>

      <button
        type="button"
        onClick={onReplay}
        disabled={disabled}
        aria-label={t.practice.listeningReplay}
        className="px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <RotateCcw size={15} aria-hidden="true" />
        <span>{t.practice.listeningReplay}</span>
      </button>

      {/* aria-pressed, not a checkbox: loop is a toggle button whose state
          must be announced, and colour alone never carries it. */}
      <button
        type="button"
        onClick={() => onLoopChange(!loop)}
        disabled={disabled}
        aria-pressed={loop}
        className={`px-3.5 py-2.5 min-h-[44px] border font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          loop
            ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-300'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Repeat size={15} aria-hidden="true" />
        <span>{t.practice.listeningLoop}</span>
      </button>

      <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>{t.practice.listeningSpeed}</span>
        <select
          value={playbackRate}
          disabled={disabled || availableRates.length === 0}
          onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
          className="px-2.5 py-2 min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {availableRates.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default SegmentTransportBar;
