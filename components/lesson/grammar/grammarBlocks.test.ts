import { describe, it, expect } from 'vitest';
import { parseGrammarNotes } from './parseGrammarNotes';
import {
  buildGrammarBlocks,
  deriveGrammarBlockKind,
  isLongBody,
  splitExamples,
  splitFormula,
  splitMistakes,
  splitSignalWords,
} from './grammarBlocks';

// Sprint 06A — block kinds are DERIVED from the author's own `## heading` and
// from nothing else. These tests pin the three orderings that keep the
// derivation correct, and the rule that nothing is ever synthesised.

// The real authored lesson, copied from the dev database. If the derivation
// ever stops handling the content teachers actually write, this fails first.
const REAL_LESSON = `## Concept Summary
Present Simple is used for habits, routines, and general facts.

## Grammar Rule
Use the base form of the verb with I, You, We, They.
Add -s or -es with He, She, It.

## Form and Structure
Affirmative: Subject + V / V-s/es
Negative: Subject + do/does not + V
Question: Do/Does + subject + V?

## Examples
I study English every day.
She works at a bank.

## Common Mistakes
Incorrect: She work every day.
Correct: She works every day.

## Tips
Remember to add -s or -es after He, She, and It.

## Lesson Summary
Use Present Simple for routines, habits, and general truths.`;

const build = (notes: string) => buildGrammarBlocks(parseGrammarNotes(notes));

describe('deriveGrammarBlockKind — load-bearing orderings', () => {
  it('reads a real authored lesson as the kinds it actually contains', () => {
    const { blocks, summary } = build(REAL_LESSON);

    // Author order is preserved; only the summary is pulled out.
    expect(blocks.map((block) => block.kind)).toEqual([
      'concept',
      'rule',
      'formula',
      'examples',
      'mistakes',
      'tips',
    ]);
    expect(summary?.kind).toBe('summary');
    expect(summary?.body).toContain('routines, habits, and general truths');
  });

  it('treats an anchored rule heading as a rule, not as the words inside it', () => {
    // The trap: "Rule 1 — Signal words" contains "Signal", so an unanchored
    // signalWords rule tested first would swallow it.
    expect(deriveGrammarBlockKind('Rule 1 — Signal words')).toBe('rule');
    expect(deriveGrammarBlockKind('Signal Words')).toBe('signalWords');
    // ...and a heading that merely mentions rules elsewhere is not a rule.
    expect(deriveGrammarBlockKind('Common Mistakes')).toBe('mistakes');
  });

  it('prefers Exam Trap over TOEIC Focus when a heading names both', () => {
    expect(deriveGrammarBlockKind('TOEIC Trap')).toBe('examTrap');
    expect(deriveGrammarBlockKind('Exam Trap')).toBe('examTrap');
    expect(deriveGrammarBlockKind('TOEIC Focus')).toBe('toeicFocus');
  });

  it('prefers Concept over Summary, so only the lesson summary closes a lesson', () => {
    expect(deriveGrammarBlockKind('Concept Summary')).toBe('concept');
    expect(deriveGrammarBlockKind('Lesson Summary')).toBe('summary');
  });

  it('recognises Vietnamese headings', () => {
    expect(deriveGrammarBlockKind('Công thức')).toBe('formula');
    expect(deriveGrammarBlockKind('Lỗi thường gặp')).toBe('mistakes');
    expect(deriveGrammarBlockKind('Ví dụ')).toBe('examples');
    expect(deriveGrammarBlockKind('Mẹo ghi nhớ')).toBe('tips');
    expect(deriveGrammarBlockKind('Bẫy đề thi')).toBe('examTrap');
  });

  it('keeps an unrecognised heading as a plain note rather than dropping it', () => {
    const { blocks } = build('## Something the author invented\nReal body text.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('note');
    expect(blocks[0].heading).toBe('Something the author invented');
    expect(blocks[0].body).toBe('Real body text.');
  });
});

describe('buildGrammarBlocks', () => {
  it('numbers rule cards from the heading, then by position', () => {
    const { blocks } = build('## Rule 2 — Since\nBody.\n\n## Grammar Rule\nBody.');
    expect(blocks[0].ruleNumber).toBe(2);
    expect(blocks[0].ruleTitle).toBe('Since');
    // No number in the heading, so it takes its position among rule cards.
    expect(blocks[1].ruleNumber).toBe(2);
    expect(blocks[1].ruleTitle).toBeNull();
  });

  it('keeps the original section index so LessonOutline anchors still resolve', () => {
    const { blocks, summary } = build(REAL_LESSON);
    expect(blocks.map((block) => block.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(summary?.index).toBe(6);
  });

  it('passes through the no-headings fallback untouched', () => {
    const { blocks, summary, fallbackText } = build('Just one paragraph, no headings at all.');
    expect(blocks).toHaveLength(0);
    expect(summary).toBeNull();
    expect(fallbackText).toBe('Just one paragraph, no headings at all.');
  });

  it('produces nothing at all for empty notes', () => {
    const { blocks, summary, fallbackText } = build('');
    expect(blocks).toHaveLength(0);
    expect(summary).toBeNull();
    expect(fallbackText).toBeNull();
  });
});

describe('body shapers — nothing is ever synthesised', () => {
  it('leaves an example untranslated when the author wrote no translation', () => {
    const examples = splitExamples('I study English every day.\nShe works at a bank.');
    expect(examples).toEqual([
      { en: 'I study English every day.', vi: null },
      { en: 'She works at a bank.', vi: null },
    ]);
  });

  it('splits an example only on a separator the author actually typed', () => {
    const examples = splitExamples('She works at a bank. — Cô ấy làm việc ở ngân hàng.');
    expect(examples).toEqual([
      { en: 'She works at a bank.', vi: 'Cô ấy làm việc ở ngân hàng.' },
    ]);
  });

  it('pairs a real correction, and never invents a missing one', () => {
    expect(splitMistakes('Incorrect: She work every day.\nCorrect: She works every day.')).toEqual([
      { wrong: 'She work every day.', right: 'She works every day.' },
    ]);
    // A lone wrong line stays alone — the fix is the author's to write.
    expect(splitMistakes('❌ Him loves English.')).toEqual([{ wrong: 'Him loves English.', right: null }]);
  });

  it('falls back to plain text when a mistakes block has no ❌/✅ markers', () => {
    expect(splitMistakes('Students often forget the -s ending.')).toBeNull();
  });

  it('reads formula labels from the text and never hardcodes a formula', () => {
    expect(splitFormula('Affirmative: Subject + V / V-s/es\nS + V(s/es)')).toEqual([
      { label: 'Affirmative', value: 'Subject + V / V-s/es' },
      { label: null, value: 'S + V(s/es)' },
    ]);
  });

  it('splits signal words into chips', () => {
    expect(splitSignalWords('always, usually\nevery day')).toEqual(['always', 'usually', 'every day']);
  });

  it('calls a body long only when it really is', () => {
    expect(isLongBody('Remember to add -s or -es after He, She, and It.')).toBe(false);
    expect(isLongBody('a\nb\nc\nd\ne')).toBe(true);
    expect(isLongBody('x'.repeat(241))).toBe(true);
  });
});
