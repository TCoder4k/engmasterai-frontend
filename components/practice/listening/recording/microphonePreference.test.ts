import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  readPreferredMicrophone,
  writePreferredMicrophone,
  clearPreferredMicrophone,
  resolvePreferredDevice,
} from './microphonePreference';
import type { AudioInputDevice } from './recordingService';

// Sprint 11 Phase 3.1 — the stored microphone choice.
//
// The behaviour worth pinning is not "it saves a string". It is that a stored
// id whose device has vanished is REPORTED as stale rather than falling through
// to whatever happens to be first — silently recording on a device the student
// never chose is the bug this whole phase exists to end.

const device = (deviceId: string, label: string): AudioInputDevice => ({
  deviceId,
  label,
  groupId: 'g',
  isSystemDefault: deviceId === 'default',
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('microphone preference storage', () => {
  it('round-trips a device id under a per-user key', () => {
    writePreferredMicrophone('user-1', 'realtek-1');

    expect(localStorage.getItem('engmasterai:preferred-microphone:user-1')).toBe(
      'realtek-1',
    );
    expect(readPreferredMicrophone('user-1')).toBe('realtek-1');
  });

  // Shared school and family machines are the normal case for this app, and a
  // device id is a small statement about the hardware in front of one person.
  it('keeps two users on the same machine apart', () => {
    writePreferredMicrophone('user-1', 'realtek-1');
    writePreferredMicrophone('user-2', 'usb-9');

    expect(readPreferredMicrophone('user-1')).toBe('realtek-1');
    expect(readPreferredMicrophone('user-2')).toBe('usb-9');
  });

  it('clears one user without touching the other', () => {
    writePreferredMicrophone('user-1', 'realtek-1');
    writePreferredMicrophone('user-2', 'usb-9');

    clearPreferredMicrophone('user-1');

    expect(readPreferredMicrophone('user-1')).toBeNull();
    expect(readPreferredMicrophone('user-2')).toBe('usb-9');
  });

  it('stores nothing for an anonymous caller rather than under a bare key', () => {
    writePreferredMicrophone('', 'realtek-1');

    expect(localStorage.length).toBe(0);
    expect(readPreferredMicrophone('')).toBeNull();
  });

  // Private modes and some enterprise policies throw on access. Forgetting a
  // preference is a degradation; taking the recorder down with it is not.
  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => writePreferredMicrophone('user-1', 'realtek-1')).not.toThrow();
    expect(readPreferredMicrophone('user-1')).toBeNull();
  });
});

describe('resolvePreferredDevice', () => {
  const devices = [
    device('default', 'Voice Changer Virtual Audio Device (WDM)'),
    device('realtek-1', 'Microphone (Realtek(R) Audio)'),
  ];

  it('returns the stored device when it is still present', () => {
    expect(resolvePreferredDevice(devices, 'realtek-1')).toEqual({
      device: devices[1],
      stale: false,
    });
  });

  // THE IMPORTANT ONE. Falling back to `devices[0]` here would hand the student
  // the virtual audio device — the exact failure this phase came from — while
  // the UI showed a microphone they once approved.
  it('reports a vanished device as stale instead of substituting another', () => {
    const resolution = resolvePreferredDevice(devices, 'usb-unplugged');

    expect(resolution.device).toBeNull();
    expect(resolution.stale).toBe(true);
  });

  it('is not stale when there was never a preference', () => {
    expect(resolvePreferredDevice(devices, null)).toEqual({
      device: null,
      stale: false,
    });
  });

  // An empty list means permission has not been granted or the enumeration
  // failed — neither of which is evidence that the student's microphone is gone.
  it('does not call a preference stale when no devices could be listed at all', () => {
    expect(resolvePreferredDevice([], 'realtek-1')).toEqual({
      device: null,
      stale: false,
    });
  });
});
