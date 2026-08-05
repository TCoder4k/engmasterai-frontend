// Sprint 11 — timestamp entry for the Listening segment editor.
//
// Pure, and separated from the editor component precisely because it is the
// part that can corrupt data silently. Segments are stored as INTEGER
// MILLISECONDS; an admin transcribing against a video player is reading
// `1:23`. Getting that conversion subtly wrong (a dropped decimal, minutes
// read as seconds) produces timings that look plausible in the table and play
// the wrong sentence.
//
// Accepted input, all meaning the same 83.5 seconds:
//   "1:23.5"     mm:ss.fff
//   "83.5"       plain seconds
//   "83500ms"    explicit milliseconds
//
// Returns null for anything it cannot read, so the caller can show the field
// as invalid instead of silently storing 0 — which would put the sentence at
// the start of the recording.

/** Parse an admin-entered timestamp into whole milliseconds, or null. */
export const parseTimeInput = (raw: string): number | null => {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  if (value.endsWith('ms')) {
    const ms = Number(value.slice(0, -2).trim());
    return Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null;
  }

  if (value.includes(':')) {
    const parts = value.split(':');
    if (parts.length !== 2) return null;
    const [minutePart, secondPart] = parts;
    const minutes = Number(minutePart);
    const seconds = Number(secondPart);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
    return Math.round(minutes * 60_000 + seconds * 1_000);
  }

  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.round(seconds * 1_000)
    : null;
};

/**
 * Render milliseconds as `m:ss.f`, the form an admin reads off a player.
 *
 * Tenths are always shown: sentence boundaries land on fractions of a second,
 * and rounding them away in the editor would make a saved value look different
 * from the one that was typed.
 */
export const formatTimeInput = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
};
