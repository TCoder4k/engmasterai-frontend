// Practice feedback sounds (Sprint 03E) — tiny Web Audio-generated tones,
// no audio assets, no third-party hotlinks, no npm package. Every entry
// point is fail-safe: a missing/broken AudioContext (old browser, autoplay
// policy, jsdom in tests) silently no-ops — sound is an enhancement layered
// on top of the mandatory visual feedback, never a dependency of the flow.
//
// The AudioContext is created lazily on the first play call, which in this
// codebase only ever happens inside a user-interaction handler (answering,
// matching, timeouts of a session the user started), satisfying browser
// user-gesture requirements.
//
// Mute preference: stored under one device-level localStorage key, the same
// convention as the language preference ('language' — a plain global key,
// not per-user). Best-effort — if storage is unavailable the toggle still
// works for the current page lifetime.

// Sprint 06B.5 — renamed from 'engmasterai:practiceSoundMuted': these
// sounds are no longer practice-only, they now cover the lesson quiz too.
// The old key is still READ once and migrated forward, so a student who
// muted sound before this sprint does not silently get it back.
const MUTE_STORAGE_KEY = 'engmasterai:soundMuted';
const LEGACY_MUTE_STORAGE_KEY = 'engmasterai:practiceSoundMuted';

let audioContext: AudioContext | null = null;
let muted: boolean | null = null;

const readStoredMute = (): boolean => {
  try {
    const current = localStorage.getItem(MUTE_STORAGE_KEY);
    if (current !== null) return current === 'true';

    const legacy = localStorage.getItem(LEGACY_MUTE_STORAGE_KEY);
    if (legacy === null) return false;

    // Migrate forward once, then stop consulting the old key. Best-effort:
    // if the write fails we still honour the value we just read.
    const wasMuted = legacy === 'true';
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(wasMuted));
      localStorage.removeItem(LEGACY_MUTE_STORAGE_KEY);
    } catch {
      // Ignore — the preference is still correct for this page lifetime.
    }
    return wasMuted;
  } catch {
    return false;
  }
};

export const isMuted = (): boolean => {
  if (muted === null) muted = readStoredMute();
  return muted;
};

export const setMuted = (next: boolean): void => {
  muted = next;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(next));
  } catch {
    // Best-effort persistence only.
  }
};

const getContext = (): AudioContext | null => {
  try {
    type AudioContextCtor = typeof AudioContext;
    const Ctor =
      (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === 'suspended') {
      // Fire-and-forget — if resume is rejected we just stay silent.
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
};

interface ToneStep {
  frequency: number;
  startAt: number;
  duration: number;
  type?: OscillatorType;
}

const playTones = (steps: ToneStep[], volume = 0.08): void => {
  if (isMuted()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    for (const step of steps) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = step.type || 'sine';
      oscillator.frequency.value = step.frequency;
      const start = now + step.startAt;
      const end = start + step.duration;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  } catch {
    // Never let a sound failure break the practice flow.
  }
};

// Sprint 06B.5 — the sound of CHOOSING, not of being right.
//
// Fired when a student selects an option, at which point correctness is
// unknown to the client by design. Deliberately a single short, low,
// quiet blip: playCorrect below is a rising two-note figure, so these two
// can never be confused, and a selection can never be mistaken for a
// verdict. Quieter than every other cue here (0.03 vs 0.08) because it
// fires far more often.
export const playSelect = (): void =>
  playTones([{ frequency: 440, startAt: 0, duration: 0.012 }], 0.03);

export const playCorrect = (): void =>
  playTones([
    { frequency: 660, startAt: 0, duration: 0.09 },
    { frequency: 880, startAt: 0.09, duration: 0.14 },
  ]);

export const playIncorrect = (): void =>
  playTones([
    { frequency: 330, startAt: 0, duration: 0.1 },
    { frequency: 262, startAt: 0.1, duration: 0.16 },
  ]);

export const playTimeout = (): void =>
  playTones([{ frequency: 220, startAt: 0, duration: 0.3, type: 'square' }], 0.045);

export const playComplete = (): void =>
  playTones([
    { frequency: 523, startAt: 0, duration: 0.1 },
    { frequency: 659, startAt: 0.1, duration: 0.1 },
    { frequency: 784, startAt: 0.2, duration: 0.1 },
    { frequency: 1047, startAt: 0.3, duration: 0.22 },
  ]);

// Speaking Partner — a rising blip on record START and a falling one on
// record STOP/send, mirroring playCorrect/playIncorrect's own
// rising-vs-falling contrast so the two are never confused by ear. Routed
// through the exact same playTones() helper as every cue above: fails
// silently on a blocked/suspended/missing AudioContext, and is muted by the
// same global preference — recording itself must never depend on this.
export const playRecordStart = (): void =>
  playTones([{ frequency: 523, startAt: 0, duration: 0.07 }], 0.05);

export const playRecordStop = (): void =>
  playTones([{ frequency: 392, startAt: 0, duration: 0.09 }], 0.05);
