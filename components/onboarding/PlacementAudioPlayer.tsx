import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, VolumeX } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { speakText, cancelSpeech, isTtsSupported } from '../../services/tts';

interface PlacementAudioPlayerProps {
  // A real recording, when one exists — always takes precedence over
  // transcript playback below.
  audioUrl: string | null;
  // Spoken dialogue for browser TTS playback, used only when audioUrl is
  // absent. The server never puts this text in `content` — this component
  // reads it aloud, it must never render it as visible text (that would
  // leak the audio's script straight onto the question card).
  transcript: string | null;
}

const BAR_COUNT = 28;

// Deterministic, decorative bar heights — NOT derived from real audio
// analysis. Building a true waveform would mean decoding the audio file
// client-side (Web Audio API) for a purely visual flourish; the product
// decision was to keep this a decoration while real playback still drives
// the time label and fill position.
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const wave = Math.sin(i * 0.9) * 0.5 + Math.sin(i * 0.35) * 0.5;
  return 28 + Math.round(((wave + 1) / 2) * 72); // 28-100%
});

const formatTime = (rawSeconds: number): string => {
  const seconds = Number.isFinite(rawSeconds) && rawSeconds > 0 ? rawSeconds : 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Custom listening-question player. Caller (PlacementTestStep, via
// QuizQuestionCard's `variant="placement"` branch) mounts a fresh instance
// per question — keyed on question.id — so unmounting this component IS the
// cleanup: React tears down the underlying <audio> element (or, in TTS mode,
// the effect below explicitly cancels any speech in flight), which stops
// playback, satisfying the "no audio ever overlaps across questions"
// invariant without this component needing to know about question changes
// itself.
const PlacementAudioPlayer: React.FC<PlacementAudioPlayerProps> = ({ audioUrl, transcript }) => {
  const { t } = useTranslation();

  if (audioUrl) {
    return <RecordedAudioPlayer audioUrl={audioUrl} />;
  }
  if (transcript && isTtsSupported()) {
    return <SpokenTranscriptPlayer transcript={transcript} />;
  }
  return (
    <div className="my-4 flex items-center gap-2 rounded-2xl border border-slate-100 dark:border-ink-700 bg-slate-50/60 dark:bg-ink-800/40 p-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
      <VolumeX size={16} aria-hidden="true" className="flex-shrink-0" />
      {t.onboarding.testAudioUnsupported}
    </div>
  );
};

// Real recorded audio — used once a question has a genuine audioUrl.
const RecordedAudioPlayer: React.FC<{ audioUrl: string }> = ({ audioUrl }) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      // Belt-and-suspenders alongside the unmount-stops-playback behavior
      // above: explicit, not merely relied upon.
      audio.pause();
    };
  }, []);

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const filledBars = Math.round(progressRatio * BAR_COUNT);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  const replay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    void audio.play();
    setPlaying(true);
  };

  return (
    <div className="my-4 flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-ink-700 bg-slate-50/60 dark:bg-ink-800/40 p-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- decorative controls above replace native captions/controls */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" data-testid="placement-audio-element" />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? t.onboarding.testAudioPause : t.onboarding.testAudioPlay}
        className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {playing ? (
          <Pause size={18} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play size={18} fill="currentColor" className="ml-0.5" aria-hidden="true" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* min-w-0 lets this shrink below its 28-bar content width instead of
            forcing the row to overflow into the time label/replay button
            next to it (the row's gap alone needs 27*3=81px, more than this
            div gets on a narrow phone) — overflow-hidden then clips the
            excess bars cleanly rather than letting them spill out. */}
        <div
          className="flex-1 min-w-0 overflow-hidden flex items-center gap-[3px] h-8"
          aria-hidden="true"
        >
          {BAR_HEIGHTS.map((height, i) => (
            <span
              key={i}
              style={{ height: `${height}%` }}
              className={`flex-1 rounded-full transition-colors duration-150 ${
                i < filledBars ? 'bg-blue-500 dark:bg-blue-400' : 'bg-slate-200 dark:bg-ink-700'
              }`}
            />
          ))}
        </div>
        <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <button
        type="button"
        onClick={replay}
        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-ink-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-ink-900 transition-colors"
      >
        <RotateCcw size={13} aria-hidden="true" />
        {t.onboarding.testReplayAudio}
      </button>
    </div>
  );
};

// No recording exists yet for this question — read the dialogue aloud via
// the browser's Web Speech API instead (services/tts.ts, the same
// established "practice aid, not a canonical pronunciation reference"
// mechanism already used elsewhere in the app). The transcript text itself
// is NEVER rendered — only spoken — so this looks and behaves like a real
// audio player from the student's side.
const WORDS_PER_MINUTE = 150;

// Web Speech API exposes no real duration or playback position, unlike a
// real <audio> element — this is a rough reading-speed estimate purely to
// drive the decorative progress fill/timer, not a promise. onEnd always
// snaps the display to "done" regardless of how the estimate tracked.
const estimateDurationSeconds = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round((words / WORDS_PER_MINUTE) * 60));
};

const SpokenTranscriptPlayer: React.FC<{ transcript: string }> = ({ transcript }) => {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const durationRef = useRef(estimateDurationSeconds(transcript));
  const tickIntervalRef = useRef<number | null>(null);

  const stopTicking = () => {
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };

  useEffect(() => {
    // Explicit, not merely relied upon — a fresh instance mounts per
    // question, so unmounting on question-change already stops speech via
    // React teardown, but this guarantees no lingering utterance survives a
    // fast navigation before that teardown completes.
    return () => {
      stopTicking();
      cancelSpeech();
    };
  }, []);

  const speak = () => {
    setElapsed(0);
    setPlaying(true);
    stopTicking();
    tickIntervalRef.current = window.setInterval(() => {
      setElapsed((prev) => Math.min(durationRef.current, prev + 0.2));
    }, 200);

    speakText(transcript, {
      onEnd: () => {
        stopTicking();
        setPlaying(false);
        setElapsed(durationRef.current);
      },
      onError: () => {
        stopTicking();
        setPlaying(false);
      },
    });
  };

  const togglePlay = () => {
    if (playing) {
      // Web Speech API has no reliable cross-browser pause/resume, so
      // "Pause" fully stops the utterance — pressing Play again restarts
      // from the beginning, same as Replay, by design.
      stopTicking();
      cancelSpeech();
      setPlaying(false);
    } else {
      speak();
    }
  };

  const replay = () => {
    cancelSpeech();
    speak();
  };

  const duration = durationRef.current;
  const progressRatio = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const filledBars = Math.round(progressRatio * BAR_COUNT);

  return (
    <div className="my-4 flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-ink-700 bg-slate-50/60 dark:bg-ink-800/40 p-3">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? t.onboarding.testAudioPause : t.onboarding.testAudioPlay}
        className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {playing ? (
          <Pause size={18} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play size={18} fill="currentColor" className="ml-0.5" aria-hidden="true" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* min-w-0 lets this shrink below its 28-bar content width instead of
            forcing the row to overflow into the time label/replay button
            next to it (the row's gap alone needs 27*3=81px, more than this
            div gets on a narrow phone) — overflow-hidden then clips the
            excess bars cleanly rather than letting them spill out. */}
        <div
          className="flex-1 min-w-0 overflow-hidden flex items-center gap-[3px] h-8"
          aria-hidden="true"
        >
          {BAR_HEIGHTS.map((height, i) => (
            <span
              key={i}
              style={{ height: `${height}%` }}
              className={`flex-1 rounded-full transition-colors duration-150 ${
                i < filledBars ? 'bg-blue-500 dark:bg-blue-400' : 'bg-slate-200 dark:bg-ink-700'
              }`}
            />
          ))}
        </div>
        <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {formatTime(elapsed)} / {formatTime(duration)}
        </span>
      </div>

      <button
        type="button"
        onClick={replay}
        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-ink-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-ink-900 transition-colors"
      >
        <RotateCcw size={13} aria-hidden="true" />
        {t.onboarding.testReplayAudio}
      </button>
    </div>
  );
};

export default PlacementAudioPlayer;
