import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isMuted,
  setMuted,
  playSelect,
  playCorrect,
  playIncorrect,
  playTimeout,
  playComplete,
} from './feedbackSounds';

// jsdom has no AudioContext at all — which is exactly the environment these
// tests exercise: every play call must be a silent no-op, never a throw
// ("failure to play must never break the flow").
describe('feedbackSounds', () => {
  beforeEach(() => {
    localStorage.clear();
    setMuted(false);
  });

  it('every play function is safe when no AudioContext exists', () => {
    expect(() => {
      playSelect();
      playCorrect();
      playIncorrect();
      playTimeout();
      playComplete();
    }).not.toThrow();
  });

  it('mute state round-trips through the service and persists to storage', () => {
    expect(isMuted()).toBe(false);

    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem('engmasterai:soundMuted')).toBe('true');

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(localStorage.getItem('engmasterai:soundMuted')).toBe('false');
  });

  it('playing while muted is also a safe no-op', () => {
    setMuted(true);
    expect(() => playCorrect()).not.toThrow();
  });
});

// Sprint 06B.5 renamed the key from 'engmasterai:practiceSoundMuted' (these
// sounds are no longer practice-only). A student who muted sound before the
// rename must not silently get it back — the old key is read once and
// migrated forward.
//
// resetModules + a fresh import is required because the service caches the
// resolved mute value at module scope after the first read.
describe('feedbackSounds — legacy mute key migration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('honours a pre-rename muted preference and writes it forward', async () => {
    localStorage.setItem('engmasterai:practiceSoundMuted', 'true');

    const fresh = await import('./feedbackSounds');
    expect(fresh.isMuted()).toBe(true);
    expect(localStorage.getItem('engmasterai:soundMuted')).toBe('true');
    // The old key is retired once migrated, so this only ever happens once.
    expect(localStorage.getItem('engmasterai:practiceSoundMuted')).toBeNull();
  });

  it('honours a pre-rename UNmuted preference too', async () => {
    localStorage.setItem('engmasterai:practiceSoundMuted', 'false');

    const fresh = await import('./feedbackSounds');
    expect(fresh.isMuted()).toBe(false);
    expect(localStorage.getItem('engmasterai:soundMuted')).toBe('false');
  });

  it('prefers the new key when both exist', async () => {
    localStorage.setItem('engmasterai:soundMuted', 'false');
    localStorage.setItem('engmasterai:practiceSoundMuted', 'true');

    const fresh = await import('./feedbackSounds');
    expect(fresh.isMuted()).toBe(false);
  });

  it('defaults to unmuted when neither key exists', async () => {
    const fresh = await import('./feedbackSounds');
    expect(fresh.isMuted()).toBe(false);
  });
});
