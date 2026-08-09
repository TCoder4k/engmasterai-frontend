import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BLANK_PLACEHOLDER, findLiteralMatch, blankSentence, pickUsableExample } from './wordBlanking';
import { VocabWordExample } from '../../../types';

const example = (sentence: string, id = 'e1'): VocabWordExample => ({
  id,
  sentence,
  translation: null,
  orderIndex: 0,
});

describe('findLiteralMatch', () => {
  it('finds a case-insensitive literal occurrence', () => {
    expect(findLiteralMatch('The Contract was signed.', 'contract')).toEqual({ start: 4, end: 12 });
  });

  it('returns null when the word does not occur verbatim (e.g. an irregular inflected form)', () => {
    expect(findLiteralMatch('They ran home yesterday.', 'run')).toBeNull();
  });
});

describe('blankSentence', () => {
  it('replaces the matched word with the blank placeholder and keeps the surrounding text', () => {
    render(<div>{blankSentence('The contract was signed yesterday.', 'contract')}</div>);
    expect(screen.getByText(BLANK_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByText(/The/)).toBeInTheDocument();
    expect(screen.getByText(/was signed yesterday/)).toBeInTheDocument();
    expect(screen.queryByText('contract')).not.toBeInTheDocument();
  });

  it('returns null (never the raw sentence) when there is no literal match', () => {
    expect(blankSentence('They ran home yesterday.', 'run')).toBeNull();
  });
});

describe('pickUsableExample', () => {
  it('returns the first example whose sentence literally contains the word, skipping earlier unusable ones', () => {
    const examples = [
      example('They ran home yesterday.', 'e1'), // irregular inflection, unusable
      example('She likes to run every morning.', 'e2'), // literal, usable
    ];
    expect(pickUsableExample(examples, 'run')).toBe(examples[1]);
  });

  it('returns null when no example qualifies', () => {
    const examples = [example('They ran home yesterday.')];
    expect(pickUsableExample(examples, 'run')).toBeNull();
  });

  it('returns null for an empty examples array', () => {
    expect(pickUsableExample([], 'run')).toBeNull();
  });
});
