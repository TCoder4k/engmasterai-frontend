import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMicrophones } from './useMicrophones';
import { writePreferredMicrophone, readPreferredMicrophone } from './microphonePreference';
import {
  installRecordingMocks,
  restoreRecordingMocks,
  RecordingMocks,
} from './testDoubles';

// Sprint 11 Phase 3.1 — choosing a microphone, and noticing when it leaves.
//
// The default fixture is the machine this phase came from: Chrome's `'default'`
// entry is a "Voice Changer Virtual Audio Device (WDM)" and the real Realtek
// microphone is second. Several assertions below only mean something because of
// that ordering.

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

let mocks: RecordingMocks;

beforeEach(() => {
  localStorage.clear();
  mocks = installRecordingMocks();
});

afterEach(() => {
  restoreRecordingMocks();
  vi.restoreAllMocks();
});

const grant = async (result: { current: ReturnType<typeof useMicrophones> }) => {
  await act(async () => {
    result.current.requestAccess();
    await flush();
  });
};

describe('useMicrophones — permission', () => {
  // Device LABELS are empty until permission is granted, so a chooser built on
  // mount would be a list of "Microphone 2". Prompting on load also asks before
  // the student has done anything that needs a microphone.
  it('asks for nothing until it is told to', () => {
    const { result } = renderHook(() => useMicrophones('user-1'));

    expect(result.current.access).toBe('UNKNOWN');
    expect(mocks.getUserMedia).not.toHaveBeenCalled();
    expect(mocks.enumerateDevices).not.toHaveBeenCalled();
  });

  it('prompts, then enumerates, in that order', async () => {
    const order: string[] = [];
    mocks.getUserMedia.mockImplementation(() => {
      order.push('getUserMedia');
      return Promise.resolve(mocks.stream);
    });
    mocks.enumerateDevices.mockImplementation(() => {
      order.push('enumerateDevices');
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(order).toEqual(['getUserMedia', 'enumerateDevices']);
  });

  // The permission stream exists only to unlock the labels. Holding it would
  // light the OS recording indicator while the student reads a list of names.
  it('releases the permission stream immediately', async () => {
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(mocks.track.stop).toHaveBeenCalled();
  });

  it('reports a refused prompt as blocked, with its own kind', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ denyWith: 'NotAllowedError' });
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(result.current.access).toBe('BLOCKED');
    expect(result.current.errorKind).toBe('PERMISSION_DENIED');
    expect(result.current.devices).toHaveLength(0);
  });
});

describe('useMicrophones — the device list', () => {
  it('lists audio inputs only', async () => {
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(result.current.devices.map((device) => device.deviceId)).toEqual([
      'default',
      'realtek-1',
    ]);
    expect(result.current.devices.some((device) => device.label.includes('Speakers'))).toBe(
      false,
    );
  });

  // THE TEMPTATION THIS TEST FORBIDS. It would be easy to drop devices whose
  // names look virtual, and it would be wrong: names are unschema'd vendor
  // strings, and loopback and broadcast devices legitimately look the same.
  // The signal is measured by the preflight, never guessed from a label.
  it('does not hide a virtual audio device', async () => {
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(
      result.current.devices.some((device) => device.label.includes('Voice Changer')),
    ).toBe(true);
  });

  it('names an unlabelled device by position rather than exposing its id', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({
      devices: [{ kind: 'audioinput', deviceId: 'a-very-long-opaque-hash', label: '' }],
    });
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(result.current.devices[0].label).toBe('Microphone 1');
    expect(result.current.devices[0].label).not.toContain('a-very-long-opaque-hash');
  });

  it('offers no chooser on a browser without enumerateDevices', async () => {
    restoreRecordingMocks();
    mocks = installRecordingMocks({ withoutDeviceSelection: true });
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(result.current.access).toBe('READY');
    expect(result.current.devices).toHaveLength(0);
  });
});

describe('useMicrophones — selection and preference', () => {
  it('saves the chosen device under the user key', async () => {
    const { result } = renderHook(() => useMicrophones('user-1'));
    await grant(result);

    act(() => result.current.select('realtek-1'));

    expect(result.current.selected?.deviceId).toBe('realtek-1');
    expect(readPreferredMicrophone('user-1')).toBe('realtek-1');
  });

  it('restores a saved device that is still connected', async () => {
    writePreferredMicrophone('user-1', 'realtek-1');
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    // Not `'default'`, which is first in the list and is the virtual device.
    expect(result.current.selected?.deviceId).toBe('realtek-1');
    expect(result.current.preferenceWasStale).toBe(false);
  });

  it('clears a saved device that has been unplugged and says so', async () => {
    writePreferredMicrophone('user-1', 'usb-gone');
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(result.current.preferenceWasStale).toBe(true);
    expect(result.current.selected).toBeNull();
    expect(readPreferredMicrophone('user-1')).toBeNull();
  });

  it('falls back to the system default only when nothing was ever chosen', async () => {
    const { result } = renderHook(() => useMicrophones('user-1'));

    await grant(result);

    expect(result.current.selected?.isSystemDefault).toBe(true);
  });
});

describe('useMicrophones — devicechange', () => {
  it('subscribes once access is granted and unsubscribes on unmount', async () => {
    const { result, unmount } = renderHook(() => useMicrophones('user-1'));
    expect(mocks.deviceChangeListenerCount()).toBe(0);

    await grant(result);
    expect(mocks.deviceChangeListenerCount()).toBe(1);

    unmount();
    expect(mocks.deviceChangeListenerCount()).toBe(0);
  });

  it('picks up a newly connected microphone', async () => {
    const { result } = renderHook(() => useMicrophones('user-1'));
    await grant(result);

    mocks.setDevices([
      { kind: 'audioinput', deviceId: 'default', label: 'Built-in' },
      { kind: 'audioinput', deviceId: 'usb-new', label: 'USB Microphone' },
    ]);
    await act(async () => {
      mocks.emitDeviceChange();
      await flush();
    });

    expect(result.current.devices.map((device) => device.deviceId)).toContain('usb-new');
  });

  // Unplugging the device in use must drop the selection rather than leave a
  // chooser pointing at hardware that is gone — the panel stops any recording
  // on the back of exactly this.
  it('drops the selection when the device in use disappears', async () => {
    writePreferredMicrophone('user-1', 'realtek-1');
    const { result } = renderHook(() => useMicrophones('user-1'));
    await grant(result);
    expect(result.current.selected?.deviceId).toBe('realtek-1');

    mocks.setDevices([{ kind: 'audioinput', deviceId: 'default', label: 'Built-in' }]);
    await act(async () => {
      mocks.emitDeviceChange();
      await flush();
    });

    expect(result.current.selected).toBeNull();
    expect(result.current.preferenceWasStale).toBe(true);
    expect(readPreferredMicrophone('user-1')).toBeNull();
  });

  it('leaves an unaffected selection alone when other hardware changes', async () => {
    writePreferredMicrophone('user-1', 'realtek-1');
    const { result } = renderHook(() => useMicrophones('user-1'));
    await grant(result);

    mocks.setDevices([
      { kind: 'audioinput', deviceId: 'default', label: 'Built-in' },
      { kind: 'audioinput', deviceId: 'realtek-1', label: 'Microphone (Realtek(R) Audio)' },
      { kind: 'audioinput', deviceId: 'usb-new', label: 'USB Microphone' },
    ]);
    await act(async () => {
      mocks.emitDeviceChange();
      await flush();
    });

    expect(result.current.selected?.deviceId).toBe('realtek-1');
    expect(result.current.preferenceWasStale).toBe(false);
  });
});
