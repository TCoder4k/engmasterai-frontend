import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createRecordingUrl,
  releaseRecordingUrl,
  isEmptyRecording,
  formatBlobSize,
} from './blob';

afterEach(() => {
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  vi.restoreAllMocks();
});

const stubUrlApi = () => {
  const createObjectURL = vi.fn(() => 'blob:fake/1');
  const revokeObjectURL = vi.fn();
  (URL as unknown as Record<string, unknown>).createObjectURL = createObjectURL;
  (URL as unknown as Record<string, unknown>).revokeObjectURL = revokeObjectURL;
  return { createObjectURL, revokeObjectURL };
};

describe('object URL lifetime', () => {
  it('mints a URL for a blob', () => {
    const { createObjectURL } = stubUrlApi();
    const blob = new Blob(['x']);

    expect(createRecordingUrl(blob)).toBe('blob:fake/1');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('revokes the exact URL it was given', () => {
    const { revokeObjectURL } = stubUrlApi();

    releaseRecordingUrl('blob:fake/1');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake/1');
  });

  // Every cleanup path calls release, and most of them run when there is
  // nothing to release. Making each caller check first is how one of them
  // eventually forgets.
  it.each([[null], [undefined], ['']])('is a no-op for %p', (value) => {
    const { revokeObjectURL } = stubUrlApi();

    releaseRecordingUrl(value as string | null | undefined);

    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('isEmptyRecording', () => {
  it('treats a zero-byte blob as no recording', () => {
    expect(isEmptyRecording(new Blob([]))).toBe(true);
  });

  it('treats a missing blob as no recording', () => {
    expect(isEmptyRecording(null)).toBe(true);
  });

  it('accepts a blob with bytes', () => {
    expect(isEmptyRecording(new Blob(['abc']))).toBe(false);
  });
});

describe('formatBlobSize', () => {
  it.each([
    [0, '0 KB'],
    [-1, '0 KB'],
    [512, '512 B'],
    [2048, '2.0 KB'],
    [40_960, '40 KB'],
    [2_097_152, '2.0 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBlobSize(bytes)).toBe(expected);
  });

  it('never renders NaN', () => {
    expect(formatBlobSize(Number.NaN)).toBe('0 KB');
  });
});
