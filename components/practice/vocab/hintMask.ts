// Pure logic for GuessWordSession's 3-level hint mask — no React, unit
// tested directly (hintMask.test.ts) rather than only through rendered DOM
// assertions, since the letter-selection algorithm is the part worth
// pinning down precisely.

/** Letters/digits are maskable; everything else (spaces, hyphens,
 * apostrophes, other punctuation) is a structural character — always shown
 * literally, never starred, and never counted as a "letter" for hint
 * purposes. This is what lets "give up" stay two visible word-shapes and
 * "don't" keep its apostrophe without leaking a letter. */
export const isMaskable = (ch: string): boolean => /[a-zA-Z0-9]/.test(ch);

/** The maskable-character indices of `word`, grouped by whitespace-delimited
 * word — group 0 is the first word's letters, group 1 the second word's,
 * etc. A hyphen or apostrophe never starts a new group: "well-known" and
 * "don't" are each a single group, so their own punctuation is simply never
 * a maskable position rather than being (mis)treated as a word boundary. */
const maskableIndicesByWord = (word: string): number[][] => {
  const groups: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ' ') {
      if (current.length > 0) groups.push(current);
      current = [];
      continue;
    }
    if (isMaskable(word[i])) current.push(i);
  }
  if (current.length > 0) groups.push(current);
  return groups;
};

export interface HintPositions {
  /** Index revealed at hint level 1 — always the first letter overall. */
  level1: number;
  /** Index revealed at hint level 2, in addition to level1. */
  level2: number;
}

/** Deterministic — same word always yields the same two positions, never
 * randomized per render.
 *
 * Level 1 is always the very first letter. Level 2 depends on shape:
 *  - Multi-word (2+ space-separated words): the first letter of the NEXT
 *    hidden word — e.g. "give up" -> level1 reveals "g", level2 reveals "u".
 *  - Single word: a position near the middle of that word rather than the
 *    next sequential letter, so level 2 gives real new information instead
 *    of just extending a run — e.g. "contract" (8 letters) reveals index 0
 *    then index 3, not index 1.
 * For very short words the "middle" can coincide with level1's own index;
 * when it does, the last letter is used instead so level 2 always reveals
 * something level 1 didn't. */
export const pickHintPositions = (word: string): HintPositions => {
  const wordGroups = maskableIndicesByWord(word);
  const allPositions = wordGroups.flat();
  if (allPositions.length === 0) return { level1: -1, level2: -1 };

  const level1 = allPositions[0];

  let level2: number;
  if (wordGroups.length >= 2 && wordGroups[1].length > 0) {
    level2 = wordGroups[1][0];
  } else {
    const positions = wordGroups[0] ?? allPositions;
    const middle = Math.floor((positions.length - 1) / 2);
    level2 = middle === 0 ? positions[positions.length - 1] : positions[middle];
  }
  return { level1, level2 };
};

/** Renders `word` with every maskable character at an index NOT in
 * `revealedIndices` replaced by `*`; structural characters (spaces,
 * hyphens, apostrophes, ...) and revealed letters pass through unchanged.
 * No separator between characters — the star count itself is the exact
 * target length, by design: "contract" -> "********", "give up" -> "**** **". */
export const buildHintMask = (word: string, revealedIndices: ReadonlySet<number>): string =>
  word
    .split('')
    .map((ch, i) => (isMaskable(ch) ? (revealedIndices.has(i) ? ch : '*') : ch))
    .join('');
