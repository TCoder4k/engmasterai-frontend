import { CefrLevel, Course } from '../../types';

// Sprint 05 — DISPLAY-ONLY collection/level derivation for the Grammar module.
//
// The backend has no `Course.category`, no `Course.level` and no `slug`
// (prisma/schema.prisma, model Course) — the only stable metadata a student
// endpoint returns is `title` and `type`. Rather than invent a taxonomy or
// drop the collection filter entirely, the four collection names the product
// uses are matched against the title with explicit, reviewable rules.
//
// The rules that keep this honest, and that the tests enforce:
//
//   1. `null` is a real, expected outcome. A course whose title matches
//      nothing gets NO chip and is bucketed nowhere — it simply appears under
//      "All". There is deliberately no default category, because assigning one
//      would be exactly the fabrication this avoids.
//   2. A category is only ever returned when its own name is literally
//      present in the title. Nothing is inferred from length, order, ID or
//      publish date.
//   3. The level is returned only when a bare CEFR token appears in the title
//      (e.g. "Destination B1"). Difficulty words like "advanced" do NOT imply
//      a level.
//
// This is a presentation helper, not a data model. When admins need to
// control the collection themselves — or a course needs a category its title
// does not spell out — the escalation is a real `Course.category` /
// `Course.level` column plus admin form fields, and this file goes away. That
// migration is deliberately not part of Sprint 05.

export type GrammarCategory = 'TOEIC' | 'GRAMMAR_IN_USE' | 'DESTINATION' | 'FOUNDATION';

// Display order for the filter row — stable regardless of fetch order, so the
// chips do not reshuffle between loads.
export const GRAMMAR_CATEGORY_ORDER: GrammarCategory[] = [
  'FOUNDATION',
  'GRAMMAR_IN_USE',
  'DESTINATION',
  'TOEIC',
];

// Ordered most-specific first: "TOEIC Grammar in Use" is a Grammar in Use
// book, so the named book series has to be tested before the exam keyword.
const CATEGORY_RULES: { category: GrammarCategory; pattern: RegExp }[] = [
  { category: 'GRAMMAR_IN_USE', pattern: /grammar\s+in\s+use/i },
  { category: 'DESTINATION', pattern: /\bdestination\b/i },
  { category: 'TOEIC', pattern: /\btoeic\b/i },
  {
    category: 'FOUNDATION',
    pattern: /\b(foundation|foundations|fundamental|fundamentals|basic|basics|beginner|beginners)\b|nền\s*tảng|cơ\s*bản/i,
  },
];

const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2)\b/i;

export const deriveGrammarCategory = (course: Pick<Course, 'title'>): GrammarCategory | null => {
  const title = course.title ?? '';
  const match = CATEGORY_RULES.find((rule) => rule.pattern.test(title));
  return match ? match.category : null;
};

// Only ever a token the title literally contains — never inferred.
export const deriveCourseLevel = (course: Pick<Course, 'title'>): CefrLevel | null => {
  const match = CEFR_PATTERN.exec(course.title ?? '');
  return match ? (match[1].toUpperCase() as CefrLevel) : null;
};

// The categories actually present in a given course set, in display order.
// Used so the filter row can never offer a chip that would return nothing.
export const presentGrammarCategories = (courses: Pick<Course, 'title'>[]): GrammarCategory[] => {
  const present = new Set(
    courses.map(deriveGrammarCategory).filter((category): category is GrammarCategory => category !== null),
  );
  return GRAMMAR_CATEGORY_ORDER.filter((category) => present.has(category));
};
