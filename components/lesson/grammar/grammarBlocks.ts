import { GrammarSection, ParsedGrammarNotes } from './parseGrammarNotes';

// Sprint 06A — DISPLAY-ONLY block typing for the Grammar theory stage.
//
// `Lesson.notes` is one text column (prisma/schema.prisma). The only structure
// it carries is the `## Heading` convention that parseGrammarNotes already
// recognises. This module puts a TYPE on each of those sections so the theory
// stage can render a formula as a formula and a mistake as a warning, instead
// of seven identical rectangles.
//
// The type is DERIVED FROM THE AUTHOR'S OWN HEADING and nothing else — the
// same discipline components/grammar/grammarCategory.ts uses for collections:
//
//   1. A kind is only returned when its own vocabulary is literally present in
//      the heading. Nothing is inferred from position, length or lesson title.
//   2. `note` is the honest fallback, not a default bucket: an unrecognised
//      heading keeps its text and its heading and is simply rendered plainly.
//      Nothing an author wrote is ever dropped (parseGrammarNotes' rule).
//   3. NOTHING IS SYNTHESISED. No translation is generated for an example, no
//      correction for a mistake, no TOEIC trap, ever. If the author did not
//      write a block, it does not exist and occupies no space on screen.
//
// Grammar cards are PROGRESSIVE. Core lessons (Foundation / A1 / A2 — Present
// Simple, Articles, Pronouns, Be verb) are expected to carry concept, rule,
// formula, examples and tips ONLY. Intermediate lessons may add mistakes and
// signal words. toeicFocus and examTrap belong to TOEIC-oriented lessons
// (Part 5/6, ETS review, exam strategy) and to nothing else — TOEIC is never
// the default shape of a grammar lesson.

export type GrammarBlockKind =
  // Core — expected in every Grammar lesson.
  | 'concept'
  | 'rule'
  | 'formula'
  | 'examples'
  // Common — intermediate lessons upward.
  | 'mistakes'
  | 'tips'
  // Optional — TOEIC-oriented lessons only.
  | 'signalWords'
  | 'toeicFocus'
  | 'examTrap'
  // Structural.
  | 'summary'
  | 'note';

export interface GrammarBlock {
  kind: GrammarBlockKind;
  /** The author's heading text, verbatim. '' for the unheaded leading section. */
  heading: string;
  body: string;
  /**
   * Index in the ORIGINAL parsed section list. LessonOutline links to
   * `#section-${index}`, so this must survive reordering or the in-page jump
   * list silently breaks.
   */
  index: number;
  /** Only ever set for `rule`. */
  ruleNumber: number | null;
  /** 'Rule 1 — Signal words' -> 'Signal words'. null when nothing remains. */
  ruleTitle: string | null;
}

export interface GrammarTheory {
  /** Author order, with the lesson summary removed. */
  blocks: GrammarBlock[];
  /** Pulled out so it always closes the stage; null when the author wrote none. */
  summary: GrammarBlock | null;
  /** Set only when the notes carry no `##` headings at all. */
  fallbackText: string | null;
}

// Matcher precedence. This ordering exists ONLY to stop one heading matching
// the wrong rule — it is not a hierarchy, and a kind appearing early here says
// nothing about whether a lesson is expected to contain it.
//
// Three orderings are load-bearing (each has a test):
//   - `rule` is ANCHORED and tested first, so '## Rule 1 — Signal words' is a
//     rule card rather than a signal-words card.
//   - `examTrap` precedes `toeicFocus`, so '## TOEIC Trap' is a trap.
//   - `concept` precedes `summary`, so '## Concept Summary' is a concept and
//     only '## Lesson Summary' closes the lesson.
const KIND_RULES: { kind: GrammarBlockKind; pattern: RegExp }[] = [
  { kind: 'rule', pattern: /^\s*(?:grammar\s+)?rules?\b|^\s*(?:quy\s*tắc|nguyên\s*tắc)\b/i },
  { kind: 'examTrap', pattern: /\btraps?\b|bẫy|pitfall/i },
  { kind: 'toeicFocus', pattern: /\btoeic\b|\bpart\s*[5-7]\b/i },
  { kind: 'signalWords', pattern: /signal|dấu\s*hiệu|từ\s*nhận\s*biết/i },
  { kind: 'formula', pattern: /formula|structure|\bforms?\b|công\s*thức|cấu\s*trúc/i },
  { kind: 'mistakes', pattern: /mistakes?|errors?|\blỗi\b|sai\s*lầm/i },
  { kind: 'tips', pattern: /\btips?\b|\bmẹo\b|lưu\s*ý|ghi\s*nhớ/i },
  { kind: 'examples', pattern: /examples?|ví\s*dụ/i },
  { kind: 'concept', pattern: /concept|overview|khái\s*niệm|tổng\s*quan|giới\s*thiệu/i },
  { kind: 'summary', pattern: /summary|recap|tóm\s*tắt|kết\s*luận|tổng\s*kết/i },
];

const RULE_PREFIX_RE = /^\s*(?:grammar\s+)?rules?\b\s*#?\s*(\d+)?\s*[-–—:.)]*\s*/i;
const RULE_PREFIX_VI_RE = /^\s*(?:quy\s*tắc|nguyên\s*tắc)\b\s*#?\s*(\d+)?\s*[-–—:.)]*\s*/i;

export const deriveGrammarBlockKind = (heading: string): GrammarBlockKind => {
  const text = heading ?? '';
  if (!text.trim()) return 'note'; // the unheaded leading section
  const match = KIND_RULES.find((rule) => rule.pattern.test(text));
  return match ? match.kind : 'note';
};

// Splits 'Rule 1 — Signal words' into its number and its remaining title. Both
// are facts about the text the author typed; neither is generated.
const parseRuleHeading = (heading: string): { number: number | null; title: string | null } => {
  const match = RULE_PREFIX_RE.exec(heading) ?? RULE_PREFIX_VI_RE.exec(heading);
  if (!match) return { number: null, title: heading.trim() || null };
  const rest = heading.slice(match[0].length).trim();
  return {
    number: match[1] ? Number(match[1]) : null,
    title: rest || null,
  };
};

const toBlock = (section: GrammarSection, index: number): GrammarBlock => {
  const kind = deriveGrammarBlockKind(section.heading);
  const rule = kind === 'rule' ? parseRuleHeading(section.heading) : { number: null, title: null };
  return {
    kind,
    heading: section.heading,
    body: section.body,
    index,
    ruleNumber: rule.number,
    ruleTitle: rule.title,
  };
};

export const buildGrammarBlocks = (parsed: ParsedGrammarNotes): GrammarTheory => {
  if (parsed.fallbackText) {
    return { blocks: [], summary: null, fallbackText: parsed.fallbackText };
  }

  const all = parsed.sections.map(toBlock);

  // Rule cards without an explicit number are numbered by their position among
  // rule cards — a fact about the document, not an invented label.
  let seenRules = 0;
  all.forEach((block) => {
    if (block.kind !== 'rule') return;
    seenRules += 1;
    if (block.ruleNumber === null) block.ruleNumber = seenRules;
  });

  // The lesson summary always closes the stage. Everything else keeps AUTHOR
  // ORDER — reordering content would be a claim about structure the author
  // did not make. A later duplicate summary stays inline as a normal block.
  const summaryIndex = all.findIndex((block) => block.kind === 'summary');
  const summary = summaryIndex >= 0 ? all[summaryIndex] : null;
  const blocks = summaryIndex >= 0 ? all.filter((_, i) => i !== summaryIndex) : all;

  return { blocks, summary, fallbackText: null };
};

/* ------------------------------------------------------------------ *
 * Body shapers.
 *
 * Each returns null when the body does not match its shape, and the card
 * falls back to rendering the text as-is. None of them ever adds content.
 * ------------------------------------------------------------------ */

const BULLET_RE = /^\s*[-*•·–—]\s*/;
const lines = (body: string): string[] =>
  body
    .split('\n')
    .map((line) => line.replace(BULLET_RE, '').trim())
    .filter(Boolean);

export interface GrammarExample {
  en: string;
  /** null when the author supplied no translation — never generated. */
  vi: string | null;
}

// One example per line. A separator splits the line into source and
// translation; WITHOUT one, `vi` stays null and no translation row renders.
const EXAMPLE_SPLIT_RE = /\s+[—–|=]\s+/;

export const splitExamples = (body: string): GrammarExample[] | null => {
  const entries = lines(body).map((line) => {
    const parts = line.split(EXAMPLE_SPLIT_RE);
    if (parts.length >= 2) {
      const en = parts[0].trim();
      const vi = parts.slice(1).join(' — ').trim();
      return { en, vi: vi || null };
    }
    return { en: line, vi: null };
  });
  return entries.length ? entries : null;
};

export interface GrammarMistake {
  wrong: string | null;
  /** null when the author wrote no correction — never generated. */
  right: string | null;
}

const WRONG_RE = /^\s*(?:❌|✗|✘|x:)\s*|^\s*(?:incorrect|wrong|sai)\s*[::]\s*/i;
const RIGHT_RE = /^\s*(?:✅|✓|✔)\s*|^\s*(?:correct|right|đúng)\s*[::]\s*/i;

// Pairs an ❌/Incorrect line with the ✅/Correct line that follows it. A wrong
// line with no correction renders ALONE — the fix is never synthesised.
export const splitMistakes = (body: string): GrammarMistake[] | null => {
  const pairs: GrammarMistake[] = [];
  let current: GrammarMistake | null = null;
  let matchedAny = false;

  const flush = () => {
    if (current) pairs.push(current);
    current = null;
  };

  // A plain loop, not forEach: `current` is reassigned across iterations and a
  // callback would defeat narrowing.
  for (const line of lines(body)) {
    if (WRONG_RE.test(line)) {
      matchedAny = true;
      flush();
      current = { wrong: line.replace(WRONG_RE, '').trim(), right: null };
      continue;
    }
    if (RIGHT_RE.test(line)) {
      matchedAny = true;
      const right = line.replace(RIGHT_RE, '').trim();
      if (current && current.right === null) {
        current.right = right;
        flush();
      } else {
        flush();
        pairs.push({ wrong: null, right });
      }
      continue;
    }
    // An unlabelled line is content too — flush what we have and keep it.
    flush();
    pairs.push({ wrong: line, right: null });
  }

  flush();
  return matchedAny && pairs.length ? pairs : null;
};

export interface GrammarFormulaLine {
  /** 'Affirmative' from 'Affirmative: S + V' — null when the line has no label. */
  label: string | null;
  value: string;
}

const FORMULA_LABEL_RE = /^([^:：]{1,40})[:：]\s*(.+)$/;

export const splitFormula = (body: string): GrammarFormulaLine[] | null => {
  const entries = lines(body).map((line) => {
    const match = FORMULA_LABEL_RE.exec(line);
    if (match) return { label: match[1].trim(), value: match[2].trim() };
    return { label: null, value: line };
  });
  return entries.length ? entries : null;
};

// Chips. Split on the separators an author would naturally reach for.
export const splitSignalWords = (body: string): string[] | null => {
  const words = body
    .split(/[,\n;·|]/)
    .map((word) => word.replace(BULLET_RE, '').trim())
    .filter(Boolean);
  return words.length ? words : null;
};

/** Collapse threshold — see GrammarBlockCard. Long is a property of the text. */
export const isLongBody = (body: string): boolean =>
  body.length > 240 || body.split('\n').filter((line) => line.trim()).length > 4;
