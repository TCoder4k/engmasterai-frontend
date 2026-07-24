import { describe, it, expect, beforeEach } from 'vitest';
import { isMuted, setMuted, playCorrect, playIncorrect, playTimeout, playComplete } from './feedbackSounds';

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
    expect(localStorage.getItem('engmasterai:practiceSoundMuted')).toBe('true');

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(localStorage.getItem('engmasterai:practiceSoundMuted')).toBe('false');
  });

  it('playing while muted is also a safe no-op', () => {
    setMuted(true);
    expect(() => playCorrect()).not.toThrow();
  });
});
