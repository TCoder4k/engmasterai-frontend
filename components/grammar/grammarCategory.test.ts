import { describe, it, expect } from 'vitest';
import {
  GrammarCategory,
  deriveCourseLevel,
  deriveGrammarCategory,
  presentGrammarCategories,
} from './grammarCategory';

// Sprint 05 — these tests exist because the collection shown on a Grammar
// card is DERIVED, not stored. The backend has no Course.category, so the
// guard that keeps this from becoming invented taxonomy is that a category
// is only ever returned when its own name is literally in the title, and
// that `null` (no chip at all) is a real, supported outcome.

const course = (title: string) => ({ title });

describe('deriveGrammarCategory', () => {
  it.each([
    ['English Grammar in Use Intermediate', 'GRAMMAR_IN_USE'],
    ['Destination B1 Grammar & Vocabulary', 'DESTINATION'],
    ['TOEIC Grammar Mastery 450-750+', 'TOEIC'],
    ['Grammar Fundamentals', 'FOUNDATION'],
    ['Ngữ pháp nền tảng', 'FOUNDATION'],
    ['Ngữ pháp cơ bản', 'FOUNDATION'],
  ] as [string, GrammarCategory][])('maps %s -> %s', (title, expected) => {
    expect(deriveGrammarCategory(course(title))).toBe(expected);
  });

  it('matches case-insensitively', () => {
    expect(deriveGrammarCategory(course('toeic part 5 grammar'))).toBe('TOEIC');
    expect(deriveGrammarCategory(course('ENGLISH GRAMMAR IN USE'))).toBe('GRAMMAR_IN_USE');
  });

  it('prefers the named book series over the exam keyword when both appear', () => {
    // "TOEIC Grammar in Use" is a Grammar in Use book, so the more specific
    // collection has to win — otherwise ordering would decide it silently.
    expect(deriveGrammarCategory(course('TOEIC Grammar in Use'))).toBe('GRAMMAR_IN_USE');
  });

  it('returns null for a title that names no collection — no default bucket', () => {
    expect(deriveGrammarCategory(course('Present Perfect vs Past Simple'))).toBeNull();
    expect(deriveGrammarCategory(course('Conditionals Deep Dive'))).toBeNull();
    expect(deriveGrammarCategory(course(''))).toBeNull();
  });

  it('never returns a category whose own name is absent from the title', () => {
    // The honesty guard: whatever comes back, the title must actually
    // contain evidence for it.
    const evidence: Record<GrammarCategory, RegExp> = {
      TOEIC: /toeic/i,
      GRAMMAR_IN_USE: /grammar\s+in\s+use/i,
      DESTINATION: /destination/i,
      FOUNDATION: /foundation|fundamental|basic|beginner|nền\s*tảng|cơ\s*bản/i,
    };

    const titles = [
      'English Grammar in Use',
      'Destination C1',
      'TOEIC Reading Grammar',
      'Grammar Basics',
      'Relative Clauses',
      'Advanced Modal Verbs',
      'Intermediate Sentence Structure',
    ];

    titles.forEach((title) => {
      const category = deriveGrammarCategory(course(title));
      if (category !== null) expect(title).toMatch(evidence[category]);
    });
  });
});

describe('deriveCourseLevel', () => {
  it('returns a CEFR token only when the title literally contains one', () => {
    expect(deriveCourseLevel(course('Destination B1 Grammar'))).toBe('B1');
    expect(deriveCourseLevel(course('Grammar in Use C2'))).toBe('C2');
    expect(deriveCourseLevel(course('destination b2'))).toBe('B2');
  });

  it('does not infer a level from difficulty words', () => {
    expect(deriveCourseLevel(course('Advanced Grammar'))).toBeNull();
    expect(deriveCourseLevel(course('Grammar for Beginners'))).toBeNull();
    expect(deriveCourseLevel(course('Intermediate Grammar'))).toBeNull();
  });

  it('does not match a CEFR-looking substring inside another token', () => {
    expect(deriveCourseLevel(course('Course AB1 Grammar'))).toBeNull();
  });
});

describe('presentGrammarCategories', () => {
  it('returns only the categories actually present, in stable display order', () => {
    const categories = presentGrammarCategories([
      course('TOEIC Grammar Mastery'),
      course('Grammar Fundamentals'),
      course('Relative Clauses'),
    ]);

    expect(categories).toEqual(['FOUNDATION', 'TOEIC']);
  });

  it('returns nothing when no course names a collection', () => {
    expect(presentGrammarCategories([course('Relative Clauses'), course('Modal Verbs')])).toEqual([]);
  });

  it('deduplicates', () => {
    expect(
      presentGrammarCategories([course('TOEIC Part 5'), course('TOEIC Part 6')]),
    ).toEqual(['TOEIC']);
  });
});
