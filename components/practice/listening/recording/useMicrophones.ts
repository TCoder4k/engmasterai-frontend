import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classifyMicrophoneError,
  enumerateAudioInputs,
  probeGrantedMicrophonePermission,
  requestMicrophoneStream,
  stopStream,
  subscribeToDeviceChange,
  AudioInputDevice,
  RecordingErrorKind,
} from './recordingService';
import {
  clearPreferredMicrophone,
  readPreferredMicrophone,
  resolvePreferredDevice,
  writePreferredMicrophone,
} from './microphonePreference';

// Sprint 11 Phase 3.1 — which microphone, and does it exist.
//
// WHY THIS EXISTS. Chrome chose a "Voice Changer Virtual Audio Device (WDM)"
// as the default input on a student's machine. The stream opened, the track
// reported itself live, the timer counted, and every sample was silence. The
// app had no way to say which device it was using and no way to choose another,
// so the only visible fact was "recording is broken".
//
// PERMISSION IS NEVER REQUESTED ON MOUNT. `enumerateDevices` returns entries
// with EMPTY LABELS until microphone permission has been granted — that is the
// platform protecting the student from a page fingerprinting their hardware on
// load. So the order is fixed and cannot be optimised: gesture, then prompt,
// then enumerate. A chooser full of "Microphone 2" is not a chooser.
//
// Sprint 11 Phase 3.2 — EXCEPT `enumerateDevices` ITSELF IS SAFE TO CALL FIRST.
// It cannot raise a prompt or open a stream on any browser, by spec, so a
// silent mount-time call answers "has this origin already been granted
// access?" for free — a non-empty label IS that grant, from an earlier visit.
// `getUserMedia` is still never called until the student presses Record; only
// the read that was always safe moved one call earlier.
//
// THE PERMISSION STREAM IS OPENED AND IMMEDIATELY CLOSED. It exists only to
// unlock the labels. Holding it would light the OS recording indicator while
// the student is still reading a list of device names.

export type MicrophoneAccess =
  /** Not asked yet. No prompt has been raised and no device names are known. */
  | 'UNKNOWN'
  /** The prompt is open. */
  | 'REQUESTING'
  /** Granted; `devices` is populated. */
  | 'READY'
  /** Refused, or failed. `errorKind` says which. */
  | 'BLOCKED';

export interface MicrophonesApi {
  access: MicrophoneAccess;
  errorKind: RecordingErrorKind | null;
  devices: AudioInputDevice[];
  /** The chosen device, or null when nothing is chosen yet. */
  selected: AudioInputDevice | null;
  /**
   * A stored preference pointed at a device that is no longer present.
   *
   * Surfaced rather than swallowed: the student picked that microphone once,
   * and silently recording on a different one is the failure this phase exists
   * to prevent.
   */
  preferenceWasStale: boolean;
  /** True once the device list has been read at least once. */
  enumerated: boolean;
  /** True while the silent mount-time permission probe is still in flight. */
  detecting: boolean;
  /** True once `access` reached READY via the silent probe, not a click on "Set up microphone". */
  autoInitialized: boolean;
  /** Raise the permission prompt (must be called from a user gesture) and enumerate. */
  requestAccess: () => void;
  select: (deviceId: string) => void;
  /** Re-read the device list without re-prompting. */
  refresh: () => void;
}

export const useMicrophones = (userId: string): MicrophonesApi => {
  const [access, setAccess] = useState<MicrophoneAccess>('UNKNOWN');
  const [errorKind, setErrorKind] = useState<RecordingErrorKind | null>(null);
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preferenceWasStale, setPreferenceWasStale] = useState(false);
  const [enumerated, setEnumerated] = useState(false);
  const [detecting, setDetecting] = useState(true);
  const [autoInitialized, setAutoInitialized] = useState(false);

  // Unmounting mid-prompt must not push state into a dead component, and the
  // prompt is the one thing here that can outlive the panel by seconds.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  /**
   * Read the device list and reconcile the current selection against it.
   *
   * The reconciliation is the whole job. Three outcomes, all of which have to
   * be distinguishable: the selection survives, the selection is gone (say so),
   * or nothing was selected and a stored preference may apply.
   */
  const loadDevices = useCallback(async () => {
    const found = await enumerateAudioInputs();
    if (!mountedRef.current) return;

    setDevices(found);
    setEnumerated(true);

    const current = selectedIdRef.current;
    if (current) {
      if (found.some((device) => device.deviceId === current)) return;
      // The device in use has disappeared. Drop the selection and the stored
      // preference rather than leaving a chooser pointing at nothing.
      clearPreferredMicrophone(userIdRef.current);
      setSelectedId(null);
      setPreferenceWasStale(true);
      return;
    }

    const stored = readPreferredMicrophone(userIdRef.current);
    const { device, stale } = resolvePreferredDevice(found, stored);
    if (device) {
      setSelectedId(device.deviceId);
      setPreferenceWasStale(false);
      return;
    }
    if (stale) {
      clearPreferredMicrophone(userIdRef.current);
      setPreferenceWasStale(true);
      return;
    }
    // No preference: fall back to the OS default if the browser names one,
    // otherwise the first entry. This is a starting point, not a decision —
    // the preflight still has to prove it works before anything is recorded.
    const fallback = found.find((entry) => entry.isSystemDefault) ?? found[0] ?? null;
    if (fallback) setSelectedId(fallback.deviceId);
  }, []);

  // Sprint 11 Phase 3.2 — a silent, gesture-free check of standing permission.
  //
  // SAFE BY CONSTRUCTION: `probeGrantedMicrophonePermission` only ever calls
  // `enumerateDevices`, which the platform guarantees cannot raise a prompt.
  // `getUserMedia` is not called here under any circumstance — if the probe
  // says "not granted", this effect does nothing further and `access` stays
  // UNKNOWN, exactly today's starting state. The button is kept hidden while
  // `detecting` is true (see the caller), which is what makes this race-free
  // against a click landing mid-probe.
  useEffect(() => {
    let settled = false;
    // A defensive ceiling: if `enumerateDevices` never settles, the button
    // must still appear rather than being silently unreachable forever.
    const giveUp = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (mountedRef.current) setDetecting(false);
    }, 1500);

    void (async () => {
      const granted = await probeGrantedMicrophonePermission();
      if (settled) return;
      settled = true;
      clearTimeout(giveUp);
      if (!mountedRef.current) return;
      if (!granted) {
        setDetecting(false);
        return;
      }
      await loadDevices();
      if (!mountedRef.current) return;
      setAccess('READY');
      setAutoInitialized(true);
      setDetecting(false);
    })();

    return () => clearTimeout(giveUp);
  }, [loadDevices]);

  const requestAccess = useCallback(() => {
    setAccess('REQUESTING');
    setErrorKind(null);
    void (async () => {
      let stream: MediaStream | null = null;
      try {
        // Unconstrained on purpose: this call's only job is to unlock the
        // device labels. Asking for a specific device here would fail for a
        // student whose stored preference is stale — before they have any way
        // to see the list and pick another.
        stream = await requestMicrophoneStream();
      } catch (caught) {
        if (!mountedRef.current) return;
        setErrorKind(classifyMicrophoneError(caught));
        setAccess('BLOCKED');
        return;
      }
      // Released immediately: labels are unlocked for the origin, and keeping
      // this open would hold the microphone while the student reads a list.
      stopStream(stream);

      await loadDevices();
      if (!mountedRef.current) return;
      setAccess('READY');
    })();
  }, [loadDevices]);

  const select = useCallback((deviceId: string) => {
    setSelectedId(deviceId);
    setPreferenceWasStale(false);
    writePreferredMicrophone(userIdRef.current, deviceId);
  }, []);

  const refresh = useCallback(() => {
    void loadDevices();
  }, [loadDevices]);

  // Hardware appearing or disappearing while the page is open is ordinary —
  // a USB headset, a Bluetooth pair, a docking station. Subscribed only after
  // access is granted, because before that the list is unreadable anyway.
  useEffect(() => {
    if (access !== 'READY') return undefined;
    return subscribeToDeviceChange(() => {
      void loadDevices();
    });
  }, [access, loadDevices]);

  const selected = devices.find((device) => device.deviceId === selectedId) ?? null;

  return {
    access,
    errorKind,
    devices,
    selected,
    preferenceWasStale,
    enumerated,
    detecting,
    autoInitialized,
    requestAccess,
    select,
    refresh,
  };
};
