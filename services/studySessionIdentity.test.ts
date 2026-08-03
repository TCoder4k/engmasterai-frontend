import { describe, expect, it } from 'vitest';
import {
  MAX_SEQUENCE,
  newStudySessionIdentity,
  rotateIfExhausted,
} from './studySessionIdentity';

describe('rotateIfExhausted', () => {
  it('leaves a fresh session alone', () => {
    const identity = { clientSessionId: 'session-a', sequence: 0 };

    expect(rotateIfExhausted(identity)).toBe(identity);
  });

  it('leaves a session with room to spare alone', () => {
    const identity = { clientSessionId: 'session-a', sequence: MAX_SEQUENCE - 2 };

    expect(rotateIfExhausted(identity)).toBe(identity);
  });

  // BEFORE the ceiling, not on it. sequence === MAX_SEQUENCE would pass the
  // backend's @Max, but the NEXT one would not — and a rejected heartbeat has
  // no UI, so the student would silently stop being credited.
  it('rotates on the last usable sequence', () => {
    const identity = { clientSessionId: 'session-a', sequence: MAX_SEQUENCE - 1 };

    const rotated = rotateIfExhausted(identity);

    expect(rotated.clientSessionId).not.toBe('session-a');
    expect(rotated.sequence).toBe(0);
  });

  it('rotates if a sequence somehow ran past the ceiling', () => {
    const rotated = rotateIfExhausted({
      clientSessionId: 'session-a',
      sequence: MAX_SEQUENCE + 500,
    });

    expect(rotated.sequence).toBe(0);
    expect(rotated.clientSessionId).not.toBe('session-a');
  });

  it('never emits a sequence the backend would reject', () => {
    let identity = newStudySessionIdentity();
    let maximum = 0;

    for (let index = 0; index < MAX_SEQUENCE * 3; index += 1) {
      identity = rotateIfExhausted(identity);
      maximum = Math.max(maximum, identity.sequence);
      identity = { ...identity, sequence: identity.sequence + 1 };
    }

    expect(maximum).toBeLessThanOrEqual(MAX_SEQUENCE);
  });
});
