import { describe, it, expect } from 'vitest';
import { formatTimeInput, parseTimeInput } from './listeningTime';

// Sprint 11 — the conversion between what an admin types and what is stored.
//
// Tested because it is the piece that fails QUIETLY. A wrong parse does not
// throw; it saves a plausible-looking timestamp that plays the wrong sentence,
// and nobody notices until a student does.

describe('parseTimeInput', () => {
  it('reads mm:ss.f', () => {
    expect(parseTimeInput('1:23.5')).toBe(83_500);
  });

  it('reads mm:ss', () => {
    expect(parseTimeInput('0:04')).toBe(4_000);
    expect(parseTimeInput('2:00')).toBe(120_000);
  });

  it('reads plain seconds', () => {
    expect(parseTimeInput('83.5')).toBe(83_500);
    expect(parseTimeInput('0')).toBe(0);
  });

  it('reads explicit milliseconds', () => {
    expect(parseTimeInput('83500ms')).toBe(83_500);
  });

  it('agrees across all three notations', () => {
    expect(parseTimeInput('1:23.5')).toBe(parseTimeInput('83.5'));
    expect(parseTimeInput('83.5')).toBe(parseTimeInput('83500ms'));
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseTimeInput('  1:23.5  ')).toBe(83_500);
  });

  it('rounds to whole milliseconds', () => {
    expect(parseTimeInput('1.00049')).toBe(1_000);
    expect(Number.isInteger(parseTimeInput('0:04.33') as number)).toBe(true);
  });

  it('returns null for empty input rather than 0', () => {
    // 0 would silently place the sentence at the start of the recording.
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('   ')).toBeNull();
  });

  it('returns null for nonsense', () => {
    expect(parseTimeInput('abc')).toBeNull();
    expect(parseTimeInput('1:2:3')).toBeNull();
    expect(parseTimeInput('1:xx')).toBeNull();
  });

  it('rejects negative values', () => {
    expect(parseTimeInput('-5')).toBeNull();
    expect(parseTimeInput('-1:30')).toBeNull();
  });

  it('rejects a seconds component of 60 or more', () => {
    // "1:75" is far more likely to be a typo than an intentional 2:15.
    expect(parseTimeInput('1:75')).toBeNull();
  });
});

describe('formatTimeInput', () => {
  it('renders m:ss.f', () => {
    expect(formatTimeInput(83_500)).toBe('1:23.5');
    expect(formatTimeInput(4_000)).toBe('0:04.0');
    expect(formatTimeInput(0)).toBe('0:00.0');
  });

  it('pads the seconds component to two digits', () => {
    expect(formatTimeInput(9_100)).toBe('0:09.1');
  });

  it('round-trips through parseTimeInput at tenth-second precision', () => {
    for (const ms of [0, 4_000, 83_500, 125_900, 600_000]) {
      expect(parseTimeInput(formatTimeInput(ms))).toBe(ms);
    }
  });
});
