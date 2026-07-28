import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Sprint 06B's governing principle: "The Quiz Engine must never assume
// Grammar. It is a generic Lesson Quiz Engine." Reuse of grammar's colour
// tokens happens through the SHARED Tailwind config, never by importing
// components/lesson/grammar modules directly — that coupling would make it
// impossible to mount this engine under a Listening or Vocabulary lesson
// later without dragging Grammar-specific code along. This test makes that
// architectural rule impossible to violate silently.
describe('the quiz engine never imports from components/lesson/grammar', () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

  it('has at least one source file to check (sanity — a passing suite over zero files proves nothing)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s does not import from ../grammar/', (file) => {
    const contents = readFileSync(join(dir, file), 'utf8');
    expect(contents).not.toMatch(/from\s+['"].*\/grammar\//);
  });
});
