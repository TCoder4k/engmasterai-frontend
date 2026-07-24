import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

// Real-audio playback with visible progress (Sprint 03E): wraps one
// HTMLAudioElement per source URL and exposes REAL currentTime/duration
// from the media element's own events — never an estimated or fabricated
// duration. Progress resets whenever the source changes; the element is
// paused and released on unmount. Playback only ever starts from the
// returned toggle/play functions, which callers wire to explicit user
// gestures (autoplay-policy compliance).
export const useAudioPlayback = (url: string | null) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlaybackState>({ isPlaying: false, currentTime: 0, duration: 0 });

  useEffect(() => {
    // New source: stop and drop the old element, reset progress.
    audioRef.current?.pause();
    audioRef.current = null;
    setState({ isPlaying: false, currentTime: 0, duration: 0 });

    if (!url) return undefined;

    const audio = new Audio(url);
    audioRef.current = audio;

    const readDuration = () =>
      setState((s) => ({ ...s, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }));
    const onTimeUpdate = () => setState((s) => ({ ...s, currentTime: audio.currentTime }));
    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));
    const onEnded = () => setState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));

    audio.addEventListener('loadedmetadata', readDuration);
    audio.addEventListener('durationchange', readDuration);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', readDuration);
      audio.removeEventListener('durationchange', readDuration);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [url]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.ended || audio.currentTime >= audio.duration) audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay-policy or codec failure — the UI simply stays paused.
    });
  }, []);

  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  }, [play]);

  return { ...state, hasAudio: Boolean(url), play, pause, toggle, replay };
};

export const formatAudioTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
