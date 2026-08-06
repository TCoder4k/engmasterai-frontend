import React, { useCallback, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { formatAudioTime } from '../../useAudioPlayback';
import { formatBlobSize } from './blob';

// Sprint 11 Phase 3 — hear your own recording back.
//
// THE NATIVE ELEMENT, NOT A CUSTOM TRANSPORT. `<audio controls>` already has
// keyboard access, a scrubber, the OS media session and correct buffering
// behaviour; rebuilding those to match the app's rounded corners would trade
// working accessibility for visual consistency on a control the student uses
// for four seconds.
//
// THIS COMPONENT NEVER CREATES OR REVOKES THE OBJECT URL. It receives one and
// renders it. Ownership sits in useRecorder, which is the only thing that knows
// when the recording is replaced — a component that minted its own URL in an
// effect would leak one per re-render on a page that re-renders whenever the
// player ticks.

interface RecordingPlaybackProps {
  /** Null until a recording exists. */
  url: string | null;
  blob: Blob | null;
  durationMs: number | null;
  mimeType: string | null;
}

const RecordingPlayback: React.FC<RecordingPlaybackProps> = ({
  url,
  blob,
  durationMs,
  mimeType,
}) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);

  // "Replay" means from the beginning. The native play button resumes from
  // wherever the playhead stopped, which is not what a student comparing their
  // reading to the sentence wants on the second press.
  const replay = useCallback(() => {
    const element = audioRef.current;
    if (!element) return;
    element.currentTime = 0;
    // A rejection here is an autoplay-policy refusal, not a crash; the element
    // simply stays paused and its own controls remain available.
    void element.play?.().catch(() => undefined);
  }, []);

  if (!url) return null;

  return (
    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {t.practice.shadowingYourRecording}
        </p>
        <button
          type="button"
          onClick={replay}
          className="px-3.5 py-2 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>{t.practice.shadowingReplayAction}</span>
        </button>
      </div>

      {/* `key` on the URL so swapping recordings resets the element rather than
          leaving the previous one's playhead and duration on screen. */}
      <audio
        ref={audioRef}
        key={url}
        src={url}
        controls
        preload="metadata"
        className="w-full"
        data-testid="recording-playback-audio"
      >
        {t.practice.listeningAudioUnsupported}
      </audio>

      {/* Measured facts about the file, useful in QA and honest in production:
          every value here comes from the blob or the clock, never a guess. */}
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {durationMs !== null && <>{formatAudioTime(durationMs / 1000)} · </>}
        {blob && <>{formatBlobSize(blob.size)}</>}
        {mimeType && <> · {mimeType}</>}
      </p>
    </div>
  );
};

export default RecordingPlayback;
