import React, { useEffect, useRef } from 'react';

// Sprint 11 Phase 3 — a REAL level meter. It was a placeholder until the bug
// that made a placeholder indefensible.
//
// The original bars were a fixed sine, and the file said so at length: drawing
// invented heights next to a microphone invites the student to read loudness
// into them. That reasoning still holds — what changed is that a fabricated
// "capture is running" animation played happily through a Chrome recording that
// was capturing nothing at all. The one fact the placeholder could show turned
// out to be the one fact it got wrong.
//
// So the heights come from AnalyserNode now, via `useRecorder`'s meter. Bars
// scroll right-to-left so the shape carries recent history rather than a single
// instant, which is what makes "nothing is arriving" visible within a second
// instead of requiring the student to stare at a static bar.
//
// aria-hidden, still: this is a picture of a signal, and a screen-reader user
// gets the same fact in words from RecordingStatusIndicator's live region and
// from the silence warning beneath it.
//
// Used by Shadowing and MicrophonePreflight. Speaking Partner has its own
// SpeakingVoiceWave (two wings flanking the mic, not one box above it) — see
// that file's header for why this one wasn't just given a variant prop.

interface RecordingWaveformProps {
  active: boolean;
  /** Current peak amplitude, 0..1, straight from the meter. */
  level: number;
  /** False when the engine has no WebAudio, so the bars are decoration and say nothing. */
  measured: boolean;
}

const BAR_COUNT = 32;
const MIN_BAR_PERCENT = 8;

const RecordingWaveform: React.FC<RecordingWaveformProps> = ({
  active,
  level,
  measured,
}) => {
  // A ring of recent levels. Held in a ref and mutated in place: this updates
  // five times a second for the whole recording, and putting it in state would
  // re-render the panel above it just as often for a purely visual change.
  const historyRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!active) {
      historyRef.current = new Array(BAR_COUNT).fill(0);
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = `${MIN_BAR_PERCENT}%`;
      });
      return;
    }
    const history = historyRef.current;
    history.shift();
    history.push(Math.max(0, Math.min(1, level)));
    history.forEach((value, index) => {
      const bar = barsRef.current[index];
      if (!bar) return;
      // sqrt, so quiet speech is visible without loud speech pinning the meter.
      // Cosmetic only — the silence verdict is taken from the raw peak, not
      // from anything on screen.
      bar.style.height = `${MIN_BAR_PERCENT + Math.sqrt(value) * (100 - MIN_BAR_PERCENT)}%`;
    });
  }, [active, level]);

  return (
    <div
      aria-hidden="true"
      data-testid="recording-waveform"
      data-measured={measured ? 'true' : 'false'}
      className={`flex items-end justify-center gap-[3px] h-12 px-3 rounded-xl border transition-colors ${
        active
          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/40'
          : 'bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-slate-800'
      }`}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          ref={(node) => {
            barsRef.current[index] = node;
          }}
          className={`w-[3px] rounded-full transition-[height] duration-150 ${
            active ? 'bg-rose-500 dark:bg-rose-400/80' : 'bg-slate-300 dark:bg-slate-700'
          }`}
          style={{ height: `${MIN_BAR_PERCENT}%` }}
        />
      ))}
    </div>
  );
};

export default RecordingWaveform;
