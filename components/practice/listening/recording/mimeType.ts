// Sprint 11 Phase 3 — choosing a container/codec for MediaRecorder.
//
// THIS IS ASKED, NEVER ASSUMED. There is no single audio MIME type every
// browser records: Chrome/Edge/Firefox produce WebM+Opus, Safari produces
// MP4/AAC and rejects WebM outright. Hardcoding one of them ships a feature
// that throws `NotSupportedError` on construction for a whole platform, and it
// throws at the moment the student presses Record — the worst possible time to
// discover it.
//
// The order below is a preference, not a guess: Opus first because it is the
// best speech codec of the set at the smallest size, MP4/AAC next because it
// is what Safari can actually do, and the bare types last as fallbacks for
// engines that reject the `;codecs=` form while supporting the container.

export const RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
] as const;

export interface MimeTypeChoice {
  /**
   * The type to pass to `new MediaRecorder(stream, { mimeType })`, or null to
   * pass no options at all and let the browser choose.
   *
   * Null is NOT "unsupported". `MediaRecorder` with no mimeType is valid and
   * is the correct call on any engine that cannot answer `isTypeSupported`;
   * passing an empty string instead would be a TypeError. The two cases are
   * distinguished by `probed`.
   */
  mimeType: string | null;
  /** True when `isTypeSupported` existed and was consulted. */
  probed: boolean;
}

type MediaRecorderCtor = {
  isTypeSupported?: (type: string) => boolean;
};

const getMediaRecorderCtor = (): MediaRecorderCtor | null => {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { MediaRecorder?: MediaRecorderCtor })
    .MediaRecorder;
  return ctor ?? null;
};

/**
 * The first candidate this browser says it can record, or null to defer to the
 * browser's own default.
 *
 * Read at CALL time, not at module load: the answer belongs to the runtime, and
 * a module-level constant would freeze whatever the test environment reported
 * when the bundle was first imported.
 */
export const pickRecordingMimeType = (): MimeTypeChoice => {
  const ctor = getMediaRecorderCtor();
  if (!ctor || typeof ctor.isTypeSupported !== 'function') {
    return { mimeType: null, probed: false };
  }
  for (const candidate of RECORDING_MIME_CANDIDATES) {
    if (ctor.isTypeSupported(candidate)) {
      return { mimeType: candidate, probed: true };
    }
  }
  // Probed and got nothing. Still not a reason to refuse: the browser may
  // record in a type it will not admit to supporting, and an empty blob is
  // detected downstream anyway.
  return { mimeType: null, probed: true };
};

/**
 * A file extension for a recorded blob, used only in user-facing labels.
 *
 * The blob's own `type` wins over whatever was requested, because a browser is
 * free to record something other than what was asked for.
 */
export const recordingFileExtension = (mimeType: string | null): string => {
  const base = (mimeType ?? '').split(';')[0].trim().toLowerCase();
  switch (base) {
    case 'audio/webm':
      return 'webm';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/aac':
      return 'aac';
    case 'audio/mpeg':
      return 'mp3';
    default:
      return 'audio';
  }
};
