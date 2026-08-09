import { describe, it, expect } from 'vitest';
import { isMaskable, pickHintPositions, buildHintMask } from './hintMask';

describe('isMaskable', () => {
  it('treats letters and digits as maskable', () => {
    expect(isMaskable('c')).toBe(true);
    expect(isMaskable('Z')).toBe(true);
    expect(isMaskable('7')).toBe(true);
  });

  it('treats spaces, hyphens, and apostrophes as structural, not maskable', () => {
    expect(isMaskable(' ')).toBe(false);
    expect(isMaskable('-')).toBe(false);
    expect(isMaskable("'")).toBe(false);
  });
});

describe('pickHintPositions — single word', () => {
  it('"contract": level1 is the first letter, level2 is a middle position, not the next sequential one', () => {
    expect(pickHintPositions('contract')).toEqual({ level1: 0, level2: 3 });
  });

  it('"niece": picks a distinct, deterministic middle-ish position', () => {
    const { level1, level2 } = pickHintPositions('niece');
    expect(level1).toBe(0);
    expect(level2).not.toBe(level1);
    expect(level2).not.toBe(1); // not simply "the next sequential character"
  });

  it('is deterministic — repeated calls for the same word return the same positions', () => {
    const results = Array.from({ length: 5 }, () => pickHintPositions('contract'));
    expect(new Set(results.map((r) => `${r.level1}-${r.level2}`)).size).toBe(1);
  });

  it('a very short word (2 letters) still yields two distinct positions', () => {
    expect(pickHintPositions('up')).toEqual({ level1: 0, level2: 1 });
  });

  it('a single-letter word has nothing left for level2 to distinctly reveal', () => {
    const { level1, level2 } = pickHintPositions('a');
    expect(level1).toBe(0);
    expect(level2).toBe(0);
  });
});

describe('pickHintPositions — multi-word', () => {
  it('"give up": level2 is the first letter of the NEXT hidden word, not a middle letter of "give"', () => {
    expect(pickHintPositions('give up')).toEqual({ level1: 0, level2: 5 });
  });

  it('a 3-word phrase still targets the second word for level2, not the third', () => {
    const { level2 } = pickHintPositions('give it up');
    // "give it up" -> g(0)i(1)v(2)e(3) (4)i(5)t(6) (7)u(8)p(9)
    expect(level2).toBe(5);
  });
});

describe('pickHintPositions — punctuation stays structural, not word-splitting', () => {
  it('a hyphenated compound is treated as one word — the hyphen itself is never a maskable position', () => {
    // "well-known" -> w(0)e(1)l(2)l(3)-(4)k(5)n(6)o(7)w(8)n(9); no space
    // anywhere in this string, so it's a single group for level2 purposes.
    const { level1, level2 } = pickHintPositions('well-known');
    expect(level1).toBe(0);
    expect(level2).not.toBe(4); // never the hyphen's own index
    expect(level2).toBeGreaterThan(0);
  });

  it('a contraction keeps its apostrophe out of the maskable position set', () => {
    // "don't" -> d(0)o(1)n(2)'(3)t(4) — 4 maskable letters at 0,1,2,4
    const { level1, level2 } = pickHintPositions("don't");
    expect(level1).toBe(0);
    expect([0, 1, 2, 4]).toContain(level2);
    expect(level2).not.toBe(3); // the apostrophe itself is never a position
  });
});

describe('buildHintMask', () => {
  it('renders the exact target length with no separators, per the approved examples', () => {
    expect(buildHintMask('cat', new Set())).toBe('***');
    expect(buildHintMask('niece', new Set())).toBe('*****');
    expect(buildHintMask('contract', new Set())).toBe('********');
    expect(buildHintMask('give up', new Set())).toBe('**** **');
  });

  it('reveals exactly the given indices, leaving the rest starred', () => {
    expect(buildHintMask('contract', new Set([0]))).toBe('c*******');
    expect(buildHintMask('contract', new Set([0, 3]))).toBe('c**t****');
  });

  it('"give up" hint progression matches the approved examples exactly', () => {
    const { level1, level2 } = pickHintPositions('give up');
    expect(buildHintMask('give up', new Set([level1]))).toBe('g*** **');
    expect(buildHintMask('give up', new Set([level1, level2]))).toBe('g*** u*');
  });

  it('never stars a space, hyphen, or apostrophe, and never counts them as revealed letters', () => {
    expect(buildHintMask('well-known', new Set())).toBe('****-*****');
    expect(buildHintMask("don't", new Set())).toBe("***'*");
  });
});
