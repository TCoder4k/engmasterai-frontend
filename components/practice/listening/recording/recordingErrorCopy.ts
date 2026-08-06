import { useTranslation } from '../../../../i18n/useTranslation';
import type { RecordingErrorKind } from './recordingService';

type Translations = ReturnType<typeof useTranslation>['t'];

// Sprint 11 Phase 3 — one message per failure, and no shared fallback.
//
// The approved scope was explicit that each kind gets its own copy rather than
// a single "Unknown error", and the reason is practical rather than stylistic:
// five of these eight are things the STUDENT can fix, but only if they are told
// which one happened. "Allow the microphone in site settings" and "close the
// app that is using your microphone" are different instructions, and a shared
// message sends everyone to the wrong one.
//
// The switch is exhaustive over the union with no `default`, so adding a kind
// to `RecordingErrorKind` fails the type-check here instead of silently
// inheriting someone else's sentence.
export const recordingErrorMessage = (
  t: Translations,
  kind: RecordingErrorKind,
): string => {
  switch (kind) {
    case 'PERMISSION_DENIED':
      return t.practice.shadowingErrorPermissionDenied;
    case 'PERMISSION_REVOKED':
      return t.practice.shadowingErrorPermissionRevoked;
    case 'DEVICE_NOT_FOUND':
      return t.practice.shadowingErrorDeviceNotFound;
    case 'DEVICE_CONSTRAINT_UNMET':
      return t.practice.shadowingErrorDeviceGone;
    case 'DEVICE_BUSY':
      return t.practice.shadowingErrorDeviceBusy;
    case 'DEVICE_ABORTED':
      return t.practice.shadowingErrorDeviceAborted;
    case 'INSECURE_CONTEXT':
      return t.practice.shadowingErrorInsecureContext;
    case 'UNSUPPORTED':
      return t.practice.shadowingErrorUnsupported;
    case 'RECORDER_FAILED':
      return t.practice.shadowingErrorRecorderFailed;
    case 'SILENT_CAPTURE':
      return t.practice.shadowingErrorSilentCapture;
    case 'RECOGNITION_FAILED':
      return t.practice.shadowingRecognitionFailed;
  }
};

/**
 * Kinds whose fix is a browser setting rather than a retry.
 *
 * These get the permission surface (instructions) instead of an inline error
 * line, because pressing "Record again" for any of them just reproduces the
 * same failure.
 */
export const isPermissionKind = (kind: RecordingErrorKind | null): boolean =>
  kind === 'PERMISSION_DENIED' ||
  kind === 'PERMISSION_REVOKED' ||
  kind === 'INSECURE_CONTEXT' ||
  kind === 'UNSUPPORTED';

/**
 * Kinds whose fix is choosing a different microphone.
 *
 * Phase 3.1 added the chooser, which turns three previously terminal errors
 * into ones the student can act on without leaving the page. Pressing "Record
 * again" for any of these reproduces the same failure on the same device, so
 * the recovery offered next to them is a device list, not a retry.
 */
export const isDeviceChoiceKind = (kind: RecordingErrorKind | null): boolean =>
  kind === 'DEVICE_CONSTRAINT_UNMET' ||
  kind === 'DEVICE_BUSY' ||
  kind === 'SILENT_CAPTURE';
