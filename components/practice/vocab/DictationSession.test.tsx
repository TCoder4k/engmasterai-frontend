import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import DictationSession from './DictationSession';
import { VocabWordListItem } from '../../../types';

// Sprint 04C: checking an answer only suggests a rating — submitReview is a
// real network call, mocked the same way FlashcardSession's spec mocks it.
vi.mock('../../../services/learningService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/learningService')>(
    '../../../services/learningService',
  );
  return { ...actual, submitReview: vi.fn() };
});

import { submitReview } from '../../../services/learningService';

beforeEach(() => {
  (submitReview as ReturnType<typeof vi.fn>).mockResolvedValue({
    state: 'REVIEW',
    intervalDays: 1,
    nextReviewAt: new Date().toISOString(),
    easeFactor: 2.5,
    repetitions: 1,
    lapses: 0,
    version: 1,
  });
});

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

    // Item 1: correct answer, check, confirm the suggested Good rating.
    await userEvent.type(input, 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    // Item 2: counter moved forward; progressbar reflects one answered.
    await waitFor(() => expect(screen.getByText('Question 2/2')).toBeInTheDocument());
    expect(screen.getByRole('progressbar', { name: 'Session progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    // Finite: exactly one completion, correct totals, no cycling back.
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 2, correctCount: 2 });
  });

  it('focuses the input on mount and again after advancing to the next word', async () => {
    renderSession([word('w1', 'alpha'), word('w2', 'alpha')]);
    const input = screen.getByLabelText('Type what you hear');
    expect(input).toHaveFocus();

    await userEvent.type(input, 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    // The input is `disabled` while feedback is shown — focus is expected
    // to move away (a disabled element cannot hold it).
    expect(input).not.toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    // Real regression: focusing in the same tick that clears `feedback`
    // used to race the DOM (the input was still disabled at that instant),
    // silently failing — this pins that it actually receives focus once
    // re-enabled for the new word, with no click required.
    await waitFor(() => expect(screen.getByLabelText('Type what you hear')).toHaveFocus());
  });

  it('an incorrect answer reveals the expected word, suggests Again, and does not count as correct', async () => {
    const onComplete = renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText(/Not quite: alpha/)).toBeInTheDocument();
    const againButton = screen.getByRole('button', { name: /^Again/ });
    expect(againButton.className).toMatch(/ring-2/); // suggested rating is highlighted

    await userEvent.click(againButton);
    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'AGAIN', practiceMode: 'DICTATION' }),
      ),
    );
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 0 });
  });

  it('before checking, Enter submits the typed answer rather than a rating', async () => {
    renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(submitReview).not.toHaveBeenCalled();
  });
});

describe('DictationSession keyboard shortcuts (Enter confirms suggestion, 1-4 pick a rating)', () => {
  it('Enter confirms the suggested Good rating after a correct check', async () => {
    const onComplete = renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');

    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'GOOD', practiceMode: 'DICTATION' }),
      ),
    );
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 1 });
  });

  it('Enter confirms the suggested Again rating after an incorrect check', async () => {
    renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    await userEvent.keyboard('{Enter}');

    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'AGAIN', practiceMode: 'DICTATION' }),
      ),
    );
  });

  it('digit keys 1-4 pick a specific rating directly, bypassing the suggestion', async () => {
    renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    await userEvent.keyboard('4'); // EASY, even though Good was suggested

    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'EASY', practiceMode: 'DICTATION' }),
      ),
    );
  });

  it('digit keys and Enter-as-rating are inert before an answer has been checked', async () => {
    renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.keyboard('3'); // no feedback yet — must not rate

    expect(submitReview).not.toHaveBeenCalled();
    expect(screen.queryByText('Correct!')).not.toBeInTheDocument();
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
