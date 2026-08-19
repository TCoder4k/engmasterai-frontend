import { useCallback, useEffect, useRef, useState } from 'react';

// Speaking Partner Live — streaming playback of Gemini's 24kHz PCM16 audio,
// plus the per-turn cache that makes "Replay AI's line" possible with no
// stored audio URL anywhere (see docs/CLAUDE.md's Speaking Live "Replay"
// section for the full reasoning — this is the client half of it).
//
// GAPLESS SCHEDULING, NOT "PLAY EACH CHUNK WHEN IT ARRIVES". Chunks land
// faster than they can be scheduled back-to-back in real time only if
// scheduled explicitly — each `AudioBufferSourceNode` is started at
// `max(now, nextStartTime)`, and `nextStartTime` advances by that buffer's
// own duration, so chunk N+1 always begins exactly where chunk N ends
// (or immediately, if it arrived late) rather than overlapping or gapping.
//
// THE CONTEXT'S OWN SAMPLE RATE IS LEFT AT ITS DEFAULT. `AudioBuffer`s are
// created with an EXPLICIT 24000Hz (Gemini Live's fixed output rate,
// confirmed against the live API docs) — Web Audio resamples a buffer of a
// different rate than its context automatically, so there is no need to
// (and real cross-browser risk in trying to) force the context itself to
// 24kHz the way capture forces 16kHz on the input side.
//
// THE PER-TURN CACHE holds each turn's concatenated raw Int16 samples —
// not object URLs, not re-encoded files — small enough to keep for a whole
// session (24kHz mono 16-bit is ~48KB/second; even several minutes of AI
// speech across a session is single-digit MB) and cleared on unmount.

const OUTPUT_SAMPLE_RATE = 24000;

export interface SpeakingLivePlaybackApi {
  isSpeaking: boolean;
  /** One base64 PCM16 chunk arrived — schedule it for immediate/gapless playback and buffer it for this turn's cache. */
  handleAudioChunk: (base64Pcm16: string) => void;
  /** The current turn finished successfully — snapshot its buffered audio under `turnIndex` for replay, then reset. */
  finalizeTurnAudio: (turnIndex: number) => void;
  /** The current turn produced nothing worth keeping (turnEmpty/turnError) — drop the buffered audio, no cache entry. */
  discardCurrentTurn: () => void;
  /** Replay a previously cached turn's ORIGINAL audio — not a re-synthesized one, no network/Gemini call. */
  replay: (turnIndex: number) => void;
  /** Stops any in-progress playback (live or replay) without touching the cache. */
  stopPlayback: () => void;
}

const base64ToInt16 = (base64: string): Int16Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  // Copy into a fresh, aligned buffer — `bytes.buffer` isn't guaranteed
  // 2-byte-aligned at `bytes.byteOffset`, and Int16Array requires it.
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

const concatInt16 = (chunks: Int16Array[]): Int16Array => {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const int16ToAudioBuffer = (context: AudioContext, samples: Int16Array): AudioBuffer => {
  const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    channel[i] = value / (value < 0 ? 0x8000 : 0x7fff);
  }
  return buffer;
};

export const useSpeakingLivePlayback = (): SpeakingLivePlaybackApi => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const contextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const pendingSourcesRef = useRef(0);
  const currentTurnChunksRef = useRef<Int16Array[]>([]);
  const cacheRef = useRef<Map<number, Int16Array>>(new Map());

  const ensureContext = useCallback((): AudioContext | null => {
    if (contextRef.current && contextRef.current.state !== 'closed') return contextRef.current;
    const Ctor = (
      window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      }
    ).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const context = new Ctor();
      contextRef.current = context;
      nextStartTimeRef.current = context.currentTime;
      return context;
    } catch {
      return null;
    }
  }, []);

  const playBuffer = useCallback(
    (context: AudioContext, buffer: AudioBuffer) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const startAt = Math.max(context.currentTime, nextStartTimeRef.current);
      pendingSourcesRef.current += 1;
      setIsSpeaking(true);
      source.onended = () => {
        pendingSourcesRef.current = Math.max(0, pendingSourcesRef.current - 1);
        if (pendingSourcesRef.current === 0) setIsSpeaking(false);
      };
      try {
        source.start(startAt);
        nextStartTimeRef.current = startAt + buffer.duration;
      } catch {
        // A context in a bad state (e.g. closed mid-call) — playback is a
        // best-effort enhancement, never something that should throw back
        // into the conversation flow.
        pendingSourcesRef.current = Math.max(0, pendingSourcesRef.current - 1);
      }
    },
    [],
  );

  const handleAudioChunk = useCallback(
    (base64Pcm16: string) => {
      let samples: Int16Array;
      try {
        samples = base64ToInt16(base64Pcm16);
      } catch {
        return; // malformed chunk — never worth breaking playback over
      }
      currentTurnChunksRef.current.push(samples);

      const context = ensureContext();
      if (!context) return; // no WebAudio — text/subtitle still works, just no live audio
      try {
        playBuffer(context, int16ToAudioBuffer(context, samples));
      } catch {
        // Best-effort — see playBuffer's own comment.
      }
    },
    [ensureContext, playBuffer],
  );

  const finalizeTurnAudio = useCallback((turnIndex: number) => {
    if (currentTurnChunksRef.current.length > 0) {
      cacheRef.current.set(turnIndex, concatInt16(currentTurnChunksRef.current));
    }
    currentTurnChunksRef.current = [];
  }, []);

  const discardCurrentTurn = useCallback(() => {
    currentTurnChunksRef.current = [];
  }, []);

  const replay = useCallback(
    (turnIndex: number) => {
      const cached = cacheRef.current.get(turnIndex);
      if (!cached) return;
      const context = ensureContext();
      if (!context) return;
      try {
        const source = context.createBufferSource();
        source.buffer = int16ToAudioBuffer(context, cached);
        source.connect(context.destination);
        source.start();
      } catch {
        // Best-effort — replay failing silently is better than throwing.
      }
    },
    [ensureContext],
  );

  const stopPlayback = useCallback(() => {
    const context = contextRef.current;
    contextRef.current = null;
    pendingSourcesRef.current = 0;
    setIsSpeaking(false);
    if (context && context.state !== 'closed') {
      context.close().catch(() => {});
    }
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  return {
    isSpeaking,
    handleAudioChunk,
    finalizeTurnAudio,
    discardCurrentTurn,
    replay,
    stopPlayback,
  };
};
