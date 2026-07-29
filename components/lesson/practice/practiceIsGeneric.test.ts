import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Sprint 06D — the architectural boundary check, mirroring
// quizEngineIsGeneric.test.ts and trapHunterIsGeneric.test.ts.
//
// Advanced Practice must be mountable under a future Vocabulary, Listening,
// Writing or Speaking lesson with no change to the stage itself. The cheapest
// durable way to enforce that is to forbid the import: a component that
// cannot reach the Grammar feature directory cannot quietly grow a dependency
// on it, and a reviewer does not have to notice.
//
// This is deliberately a source-level test rather than a behavioural one.
// "Does not branch on course type" is not observable from the outside until
// someone has already added the branch.
const PRACTICE_DIR = join(__dirname);

const sourceFiles = readdirSync(PRACTICE_DIR).filter(
  (file) => (file.endsWith('.tsx') || file.endsWith('.ts')) && !file.includes('.test.'),
);

describe('the Advanced Practice engine is subject-agnostic', () => {
  it('has source files to check', () => {
    // Guards against the glob silently matching nothing and the suite
    // passing vacuously.
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('imports nothing from the Grammar feature directory', () => {
    sourceFiles.forEach((file) => {
      const source = readFileSync(join(PRACTICE_DIR, file), 'utf-8');
      expect(source).not.toMatch(/from\s+['"].*\/grammar\//);
    });
  });

  it('never names a course type or a subject', () => {
    // The engine understands tasks, questions, answers and grades. A subject
    // name appearing here means content has leaked into the engine — the
    // authored task is where subject lives.
    const forbidden = [/CourseType/, /\bGRAMMAR\b/, /\bTOEIC\b/, /\bLISTENING\b/, /\bVOCAB/];
    sourceFiles.forEach((file) => {
      const source = readFileSync(join(PRACTICE_DIR, file), 'utf-8');
      forbidden.forEach((pattern) => {
        expect(source).not.toMatch(pattern);
      });
    });
  });

  it('does not reimplement the shared question inputs', () => {
    // Advanced Practice reuses MultipleChoiceInput/TrueFalseInput/
    // FillBlankInput/OrderingInput through QuizQuestionCard. A local
    // definition here would mean two renderings of the same answer shape
    // that can drift apart.
    sourceFiles.forEach((file) => {
      const source = readFileSync(join(PRACTICE_DIR, file), 'utf-8');
      expect(source).not.toMatch(/const\s+(MultipleChoice|TrueFalse|FillBlank|Ordering)Input/);
    });
  });
});
