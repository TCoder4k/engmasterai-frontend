import { describe, it, expect, afterEach } from 'vitest';
import {
  pickRecordingMimeType,
  recordingFileExtension,
  RECORDING_MIME_CANDIDATES,
} from './mimeType';

const setMediaRecorder = (value: unknown) => {
  (window as unknown as Record<string, unknown>).MediaRecorder = value;
};

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).MediaRecorder;
});

describe('pickRecordingMimeType', () => {
  it('returns the first candidate the browser says it supports', () => {
    setMediaRecorder({
      isTypeSupported: (type: string) => type === 'audio/webm',
    });

    expect(pickRecordingMimeType()).toEqual({ mimeType: 'audio/webm', probed: true });
  });

  it('prefers Opus over any later container when both are supported', () => {
    setMediaRecorder({ isTypeSupported: () => true });

    expect(pickRecordingMimeType().mimeType).toBe('audio/webm;codecs=opus');
  });

  // Safari: WebM is rejected outright, so a hardcoded WebM would throw
  // NotSupportedError at the moment the student pressed Record.
  it('falls through to an MP4 container when the WebM family is rejected', () => {
    setMediaRecorder({
      isTypeSupported: (type: string) => type.startsWith('audio/mp4'),
    });

    expect(pickRecordingMimeType().mimeType).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  // Null means "construct MediaRecorder with no options", which is a valid and
  // correct call — NOT "recording is impossible". `probed` is what separates
  // the two, and it is why the return type is an object.
  it('defers to the browser default when isTypeSupported does not exist', () => {
    setMediaRecorder({});

    expect(pickRecordingMimeType()).toEqual({ mimeType: null, probed: false });
  });

  it('defers to the browser default when nothing is supported, and records that it asked', () => {
    setMediaRecorder({ isTypeSupported: () => false });

    expect(pickRecordingMimeType()).toEqual({ mimeType: null, probed: true });
  });

  it('reports no probe at all when MediaRecorder is absent', () => {
    expect(pickRecordingMimeType()).toEqual({ mimeType: null, probed: false });
  });

  it('offers a candidate for each of the three engine families', () => {
    const bases = RECORDING_MIME_CANDIDATES.map((type) => type.split(';')[0]);

    expect(bases).toContain('audio/webm'); // Chrome, Edge, Firefox
    expect(bases).toContain('audio/mp4'); // Safari
    expect(bases).toContain('audio/ogg');
  });
});

describe('recordingFileExtension', () => {
  it.each([
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/webm', 'webm'],
    ['audio/ogg;codecs=opus', 'ogg'],
    ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
    ['audio/aac', 'aac'],
    ['audio/mpeg', 'mp3'],
  ])('maps %s to .%s', (mimeType, expected) => {
    expect(recordingFileExtension(mimeType)).toBe(expected);
  });

  it('falls back for an unknown or missing type instead of guessing', () => {
    expect(recordingFileExtension(null)).toBe('audio');
    expect(recordingFileExtension('audio/flac')).toBe('audio');
  });
});
