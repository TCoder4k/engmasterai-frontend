import React, { useEffect, useRef } from 'react';

// Speaking Partner's mic control flanks the button with two bar clusters
// instead of one row above it (the reference UI's layout, not Shadowing's —
// see SpeakingRecorderControl.tsx). Kept as its own small component rather
// than a variant of RecordingWaveform: that component's box-row layout and
// this one's flanking-wings layout don't share a container shape, only the
// same "heights come from a real AnalyserNode reading, never fabricated"
// rule — see RecordingWaveform.tsx's own header for why that rule exists.
//
// `recording`: the wing shows the REAL mic level (this is a picture of an
// actual signal). `aiSpeaking`: there is no mic signal to show honestly
// while the AI is talking, so the wing instead plays the app's existing
// "honest indeterminate" TTS-playback animation (`practice-speaking-bar`,
// already used elsewhere for the same reason — no invented amplitude, just
// an acknowledgment that audio is playing).

interface SpeakingVoiceWaveProps {
  recording: boolean;
  aiSpeaking: boolean;
  /** Current peak amplitude, 0..1, straight from the meter. Ignored unless `recording`. */
  level: number;
  side: 'left' | 'right';
}

const BAR_COUNT = 12;
const MIN_BAR_PX = 4;
const MAX_BAR_PX = 26;

const SpeakingVoiceWave: React.FC<SpeakingVoiceWaveProps> = ({
  recording,
  aiSpeaking,
  level,
  side,
}) => {
  const historyRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!recording) {
      historyRef.current = new Array(BAR_COUNT).fill(0);
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = `${MIN_BAR_PX}px`;
      });
      return;
    }
    const history = historyRef.current;
    history.shift();
    history.push(Math.max(0, Math.min(1, level)));
    history.forEach((value, index) => {
      const bar = barsRef.current[index];
      if (!bar) return;
      bar.style.height = `${MIN_BAR_PX + Math.sqrt(value) * (MAX_BAR_PX - MIN_BAR_PX)}px`;
    });
  }, [recording, level]);

  const active = recording || aiSpeaking;

  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-[3px] ${side === 'left' ? 'flex-row-reverse' : ''}`}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          ref={(node) => {
            barsRef.current[index] = node;
          }}
          className={`w-[3px] rounded-full transition-[height] duration-150 ${
            active ? 'bg-violet-400 dark:bg-violet-400/80' : 'bg-slate-300 dark:bg-slate-700'
          } ${aiSpeaking && !recording ? 'practice-speaking-bar' : ''}`}
          style={
            aiSpeaking && !recording
              ? { height: `${MAX_BAR_PX * 0.6}px`, animationDelay: `${index * 55}ms` }
              : { height: `${MIN_BAR_PX}px` }
          }
        />
      ))}
    </div>
  );
};

export default SpeakingVoiceWave;
