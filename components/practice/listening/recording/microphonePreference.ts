// Sprint 11 Phase 3.1 — remembering which microphone a student picked.
//
// LOCAL ONLY, AND DELIBERATELY SO. This is a preference about one browser on
// one machine, not a fact about the account: the same student on a phone has a
// different set of devices, and a server-stored choice would follow them there
// and be wrong. Nothing here is sent anywhere, and `recordingService` still
// contains no network call.
//
// KEYED PER USER, for the same reason `recentActivity` is: school and family
// devices are shared, and a stored device id is a small but real statement
// about the hardware in front of a particular person.
//
// A deviceId is NOT a stable identifier. Browsers rotate them when site
// permissions are cleared, and they differ per origin. So the stored value is
// treated as a hint that must be re-validated against a live device list on
// every load, never as a fact — see `resolvePreferredDevice`.

import type { AudioInputDevice } from './recordingService';

const keyFor = (userId: string) => `engmasterai:preferred-microphone:${userId}`;

export const readPreferredMicrophone = (userId: string): string | null => {
  if (!userId) return null;
  try {
    const stored = localStorage.getItem(keyFor(userId));
    return stored && stored.trim() ? stored : null;
  } catch {
    // Storage can throw in private modes and under some enterprise policies.
    // Forgetting a preference is a degradation, not a failure.
    return null;
  }
};

export const writePreferredMicrophone = (userId: string, deviceId: string): void => {
  if (!userId || !deviceId) return;
  try {
    localStorage.setItem(keyFor(userId), deviceId);
  } catch {
    // As above.
  }
};

export const clearPreferredMicrophone = (userId: string): void => {
  if (!userId) return;
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // As above.
  }
};

export interface PreferenceResolution {
  /** The device to use, or null when the student must choose. */
  device: AudioInputDevice | null;
  /** True when a stored preference existed and its device is gone. */
  stale: boolean;
}

/**
 * Turn a stored id into a device that actually exists right now.
 *
 * The `stale` flag is the point. A preference whose device has vanished must
 * NOT silently fall through to "whatever is first in the list" — that is how a
 * student ends up recording on a device they never chose, which is this
 * phase's entire bug wearing a different hat. The caller clears the stored
 * value and asks again.
 */
export const resolvePreferredDevice = (
  devices: AudioInputDevice[],
  storedId: string | null,
): PreferenceResolution => {
  if (!storedId) return { device: null, stale: false };
  const match = devices.find((device) => device.deviceId === storedId);
  if (match) return { device: match, stale: false };
  return { device: null, stale: devices.length > 0 };
};
