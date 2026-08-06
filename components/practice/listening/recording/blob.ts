// Sprint 11 Phase 3 — object-URL lifetime for recorded audio.
//
// WHY A MODULE FOR TWO ONE-LINE CALLS. `URL.createObjectURL` pins the blob in
// memory until `revokeObjectURL` is called for that exact string; nothing else
// releases it, and a garbage-collected React component does not. Recording is
// the first feature in this app that mints object URLs repeatedly in a loop the
// student controls (record -> retry -> record -> retry), so "who revokes it" has
// to have one answer instead of being re-decided at each call site.
//
// Routing both calls through here also makes the leak testable: a test spies on
// these two functions and asserts they balance, which is not something you can
// assert about a global.

export const createRecordingUrl = (blob: Blob): string =>
  URL.createObjectURL(blob);

/**
 * Release a URL created by `createRecordingUrl`.
 *
 * Null-tolerant and idempotent on purpose — every cleanup path (retry, segment
 * change, unmount, error) calls it, and forcing each one to check first is how
 * one of them eventually forgets.
 */
export const releaseRecordingUrl = (url: string | null | undefined): void => {
  if (!url) return;
  URL.revokeObjectURL(url);
};

/**
 * A recording that produced no bytes.
 *
 * This is a real outcome, not a defensive check: a MediaRecorder stopped within
 * a few milliseconds of starting, or one whose track was revoked mid-capture,
 * fires `stop` with zero chunks. Playing it back would give the student a
 * silent player and no explanation.
 */
export const isEmptyRecording = (blob: Blob | null | undefined): boolean =>
  !blob || blob.size === 0;

/** Human-readable size for the recording summary. Binary units, one decimal. */
export const formatBlobSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};
