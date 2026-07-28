import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

interface SegmentPlayerProps {
  isPlaying: boolean;
  playbackRate: number;
  ttsSupported: boolean;
  onPlayPause: () => void;
  onReplay: () => void;
  onSpeedChange: (rate: number) => void;
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

// Playback is TTS-only for seed content (no recorded audioUrl exists for
// this temporary content — see listeningContent.ts). Every action here
// fires only from an explicit click, never automatically on segment change,
// per the locked no-autoplay TTS discipline.
const SegmentPlayer: React.FC<SegmentPlayerProps> = ({
  isPlaying,
  playbackRate,
  ttsSupported,
  onPlayPause,
  onReplay,
  onSpeedChange,
}) => {
  const { t } = useTranslation();

  if (!ttsSupported) {
    return (
      <p className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-4">
        {t.practice.ttsNotSupported}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onReplay}
          aria-label={t.practice.listeningReplay}
          className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onPlayPause}
          aria-label={isPlaying ? t.practice.listeningPause : t.practice.listeningPlay}
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isPlaying ? <Pause size={26} aria-hidden="true" /> : <Play size={26} className="ml-1" aria-hidden="true" />}
        </button>

        <div className="w-9" aria-hidden="true" />
      </div>

      {/* Honest indeterminate speaking indicator — TTS has no reliable
          duration, so no fake time/progress bar is shown (Sprint 03E).
          Static bars when idle; animated (reduced-motion gated in CSS)
          while speaking. */}
      <div
        className="flex items-end justify-center gap-1 h-5"
        role="status"
        aria-label={isPlaying ? t.practice.speaking : undefined}
      >
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-full ${
              isPlaying ? 'practice-speaking-bar h-4 bg-gradient-to-t from-blue-500 to-indigo-400' : 'h-1.5 bg-slate-200 dark:bg-slate-700'
            }`}
            style={isPlaying ? { animationDelay: `${i * 0.1}s` } : undefined}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 mr-1">
          {t.practice.listeningSpeed}
        </span>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => onSpeedChange(speed)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
              playbackRate === speed
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
};

export default SegmentPlayer;
