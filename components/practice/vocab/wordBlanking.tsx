import React from 'react';
import { VocabWordExample } from '../../../types';

// Shared by GuessWordSession and ContextualSession: both need to find a
// target word's literal occurrence inside one of its own example sentences
// and do something with it. FlashcardSession's `renderHighlightedSentence`
// is the wrong sibling to copy from — its fallback (show the sentence
// unchanged when there's no literal match) is correct for underlining, but
// blanking must never fall back to the raw sentence, or it hands the
// student the answer.

/** Fixed glyph, never derived from `word.length` — the example must not leak
 * the target word's length while the top-level word display is still masked. */
export const BLANK_PLACEHOLDER = '_____';

/** Case-insensitive literal search. `null` means the word doesn't occur
 * verbatim in the sentence (e.g. an inflected form) — callers must treat
 * that as "this sentence can't be used," not attempt a partial blank. */
export const findLiteralMatch = (
  sentence: string,
  word: string,
): { start: number; end: number } | null => {
  const matchIndex = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (matchIndex === -1) return null;
  return { start: matchIndex, end: matchIndex + word.length };
};

/** `null` when there's no literal match — the caller must omit the example
 * entirely rather than render the sentence un-blanked. */
export const blankSentence = (sentence: string, word: string): React.ReactNode | null => {
  const match = findLiteralMatch(sentence, word);
  if (!match) return null;
  const before = sentence.slice(0, match.start);
  const after = sentence.slice(match.end);
  return (
    <>
      {before}
      <span className="font-mono tracking-wider">{BLANK_PLACEHOLDER}</span>
      {after}
    </>
  );
};

/** The first example (in order) whose sentence literally contains the word;
 * `null` if none qualify. This is the eligibility test for a blank-the-word
 * exercise — not just "does the word have an example," but "does it have
 * one this feature can actually use." */
export const pickUsableExample = (
  examples: VocabWordExample[],
  word: string,
): VocabWordExample | null => examples.find((example) => findLiteralMatch(example.sentence, word) !== null) ?? null;
