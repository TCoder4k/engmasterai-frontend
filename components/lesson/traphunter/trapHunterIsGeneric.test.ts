import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Sprint 06C's governing rule, and the same one quizEngineIsGeneric.test.ts
// enforces for the quiz: Trap Hunter is driven by MISTAKES, never by lesson
// type. It must mount unchanged under a future Vocabulary, Listening,
// Writing or Speaking lesson, which is impossible the moment anything here
// imports Grammar-specific code.
//
// Importing from ../quiz/ IS allowed and deliberate — the per-type inputs,
// the feedback panel and the answer shapes are shared with the quiz engine
// on purpose, because a trap is one of the student's own quiz questions.
// Duplicating them is what this sprint forbids; reusing them is the point.
describe('the Trap Hunter stage never imports from components/lesson/grammar', () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter(
    (file) =>
      /\.(ts|tsx)$/.test(file) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'),
  );

  it('has at least one source file to check (sanity — a passing suite over zero files proves nothing)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s does not import from ../grammar/', (file) => {
    const contents = readFileSync(join(dir, file), 'utf8');
    expect(contents).not.toMatch(/from\s+['"].*\/grammar\//);
  });

  // The subtler half: a string like "grammar" or "TOEIC" in the UI would
  // make this stage wrong for a Listening lesson even with no bad import.
  // Copy lives in i18n/translations.ts, which is checked there; here we only
  // guard against it creeping back into the components.
  it.each(files)('%s hardcodes no subject name', (file) => {
    const contents = readFileSync(join(dir, file), 'utf8');
    expect(contents).not.toMatch(/\b(TOEIC|Ngữ pháp)\b/);
  });
});
