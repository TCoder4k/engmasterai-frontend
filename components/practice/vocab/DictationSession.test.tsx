import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import DictationSession from './DictationSession';
import { VocabWordListItem } from '../../../types';

// Sprint 03E: finite-session orientation — real "Question X of N" counts, a
// real ARIA progressbar, and a definite completion (no infinite cycling).
const word = (id: string, text: string): VocabWordListItem => ({
  id,
  text,
  ipa: null,
  cefrLevel: null,
  audioUrl: null,
  imageUrl: null,
  meanings: [{ id: `m-${id}`, partOfSpeech: 'NOUN', meaning: `meaning of ${text}`, orderIndex: 0 }],
});

const renderSession = (words: VocabWordListItem[], onComplete = vi.fn()) => {
  render(
    <LanguageProvider>
      <DictationSession words={words} onComplete={onComplete} />
    </LanguageProvider>,
  );
  return onComplete;
};

afterEach(() => cleanup());

describe('DictationSession finite progress', () => {
  it('shows the real question counter and a real-valued progressbar', () => {
    // Two words with the SAME text so the correct answer is known no
    // matter how the session shuffles them.
    renderSession([word('w1', 'alpha'), word('w2', 'alpha')]);

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    const progress = screen.getByRole('progressbar', { name: 'Session progress' });
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '2');
    expect(progress).toHaveAttribute('aria-valuenow', '0');
  });

  it('advances through every item exactly once and then completes with the session totals', async () => {
    const onComplete = renderSession([word('w1', 'alpha'), word('w2', 'alpha')]);
    const input = screen.getByLabelText('Type what you hear');

    // Item 1: correct answer, check, next.
    await userEvent.type(input, 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next word' }));

    // Item 2: counter moved forward; progressbar reflects one answered.
    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Session progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next word' }));

    // Finite: exactly one completion, correct totals, no cycling back.
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 2, correctCount: 2 });
  });

  it('an incorrect answer reveals the expected word and does not count as correct', async () => {
    const onComplete = renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText(/Not quite: alpha/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next word' }));
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 0 });
  });
});

describe('DictationSession meaning reveal (Sprint 03F)', () => {
  const wordWithMeanings = (id: string, text: string, meanings: VocabWordListItem['meanings']): VocabWordListItem => ({
    id,
    text,
    ipa: null,
    cefrLevel: null,
    audioUrl: null,
    imageUrl: null,
    meanings,
  });

  it('does not show the meaning, the typed answer, or the correct word before checking', () => {
    renderSession([
      wordWithMeanings('w1', 'alpha', [
        { id: 'm1', partOfSpeech: 'NOUN', meaning: 'primary VI meaning', orderIndex: 0 },
      ]),
    ]);

    expect(screen.queryByText('primary VI meaning')).not.toBeInTheDocument();
    expect(screen.queryByText('Meaning')).not.toBeInTheDocument();
    expect(screen.queryByText('Your answer:')).not.toBeInTheDocument();
  });

  it('shows the typed answer, the correct word, and the meaning tiers after checking', async () => {
    renderSession([
      wordWithMeanings('w1', 'alpha', [
        { id: 'm1', partOfSpeech: 'NOUN', meaning: 'primary VI meaning', orderIndex: 0 },
        { id: 'm2', partOfSpeech: 'NOUN', meaning: 'secondary EN gloss', orderIndex: 1 },
        { id: 'm3', partOfSpeech: 'NOUN', meaning: 'a third sense', orderIndex: 2 },
      ]),
    ]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('primary VI meaning')).toBeInTheDocument();
    expect(screen.getByText('secondary EN gloss')).toBeInTheDocument();
    expect(screen.getByText('a third sense')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Your answer: alpha')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Correct word: alpha')).toBeInTheDocument();
  });

  it('shows an honest fallback instead of crashing when a word has no meanings', async () => {
    renderSession([wordWithMeanings('w1', 'alpha', [])]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });
});
