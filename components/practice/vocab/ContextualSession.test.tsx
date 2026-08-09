import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import ContextualSession from './ContextualSession';
import { VocabWordListItem, VocabWordExample } from '../../../types';

vi.mock('../../../services/vocabWordService', () => ({ getWord: vi.fn() }));
vi.mock('../../../services/feedbackSounds', () => ({
  playCorrect: vi.fn(),
  playIncorrect: vi.fn(),
}));

import { getWord } from '../../../services/vocabWordService';

const word = (id: string, text: string): VocabWordListItem => ({
  id,
  text,
  ipa: null,
  cefrLevel: null,
  audioUrl: null,
  imageUrl: null,
  meanings: [{ id: `m-${id}`, partOfSpeech: 'NOUN', meaning: `meaning of ${text}`, orderIndex: 0 }],
});

/** A literal-match example — `text` appears verbatim in the sentence. */
const exampleFor = (text: string, id = `e-${text}`): VocabWordExample => ({
  id,
  sentence: `I really like ${text} today.`,
  translation: `Bản dịch của ${text}`,
  orderIndex: 0,
});

const NO_EXAMPLES = { examples: [] };

const renderSession = (words: VocabWordListItem[], onComplete = vi.fn()) => {
  render(
    <LanguageProvider>
      <ContextualSession words={words} onComplete={onComplete} />
    </LanguageProvider>,
  );
  return onComplete;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ContextualSession — eligibility', () => {
  beforeEach(() => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue(NO_EXAMPLES);
  });

  it('shows the blanked sentence, translation, and options once eligible words resolve', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      Promise.resolve(id === 'w1' ? { examples: [exampleFor('apple')] } : NO_EXAMPLES),
    );
    renderSession([word('w1', 'apple'), word('w2', 'banana')]);

    expect(await screen.findByRole('button', { name: 'apple' })).toBeInTheDocument();
    expect(screen.getByText('Question 1/1')).toBeInTheDocument();
    expect(screen.getByText('_____')).toBeInTheDocument();
    expect(screen.getByText(/Bản dịch của apple/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'banana' })).toBeInTheDocument();
    // The word itself must not leak into the visible sentence text.
    expect(screen.queryByText(/I really like apple today/)).not.toBeInTheDocument();
  });

  it('a word with no usable example is excluded from the session — total reflects only the eligible word', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      Promise.resolve(id === 'w1' ? { examples: [exampleFor('apple')] } : NO_EXAMPLES),
    );
    renderSession([word('w1', 'apple'), word('w2', 'banana'), word('w3', 'cherry')]);

    expect(await screen.findByText('Question 1/1')).toBeInTheDocument();
  });

  it('a word with a usable example but no real distractor (only a case-variant duplicate in the deck) is excluded', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      Promise.resolve(id === 'w1' ? { examples: [exampleFor('Apple')] } : NO_EXAMPLES),
    );
    // "apple" is a case-variant duplicate of "Apple" — not a real distractor.
    renderSession([word('w1', 'Apple'), word('w2', 'apple')]);

    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/nothing to fill in/)).toBeInTheDocument();
  });

  it('a case-variant duplicate never appears as a separate option, and is excluded from its own distractor pool', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      Promise.resolve(id === 'w1' ? { examples: [exampleFor('Apple')] } : NO_EXAMPLES),
    );
    // "apple" (case-variant of the correct answer) must not appear; "Banana" must.
    renderSession([word('w1', 'Apple'), word('w2', 'apple'), word('w3', 'Banana')]);

    await screen.findByRole('button', { name: 'Apple' });
    expect(screen.getByText('Question 1/1')).toBeInTheDocument();
    const options = screen.getAllByRole('button', { name: /^(Apple|apple|Banana)$/ });
    expect(options).toHaveLength(2); // honest count — not padded to 4
    expect(screen.getByRole('button', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Banana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'apple' })).not.toBeInTheDocument();
  });

  it('shows the honest empty state, and never calls onComplete, when no word in the deck qualifies', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue(NO_EXAMPLES);
    const onComplete = renderSession([word('w1', 'apple'), word('w2', 'banana')]);

    expect(await screen.findByText(/nothing to fill in/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('a single getWord() rejection excludes only that word, not the whole batch', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === 'w1') return Promise.reject(new Error('network error'));
      return Promise.resolve(id === 'w2' ? { examples: [exampleFor('banana')] } : NO_EXAMPLES);
    });
    renderSession([word('w1', 'apple'), word('w2', 'banana'), word('w3', 'cherry')]);

    expect(await screen.findByRole('button', { name: 'banana' })).toBeInTheDocument();
    expect(screen.getByText('Question 1/1')).toBeInTheDocument();
  });

  it('resolves correctly for a deck larger than the concurrency limit (8 words, limit 6)', async () => {
    const texts = ['apple', 'banana', 'cherry', 'date', 'fig', 'grape', 'kiwi', 'lemon'];
    (getWord as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      const text = texts[Number(id.slice(1)) - 1];
      return Promise.resolve({ examples: [exampleFor(text, `e-${id}`)] });
    });
    renderSession(texts.map((text, i) => word(`w${i + 1}`, text)));

    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(8));
    expect(await screen.findByText('Question 1/8')).toBeInTheDocument();
  });
});

describe('ContextualSession — answering (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Both words eligible (each has a usable example and the other as a real
  // distractor), so answering the first question still leaves a second one
  // to observe the running "Correct: N" count on — a 1-question session
  // shows nothing at all once answered (same as every other session mode).
  const setUpTwoWordSession = async () => {
    (getWord as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      Promise.resolve({ examples: [exampleFor(id === 'w1' ? 'apple' : 'banana')] }),
    );
    const onComplete = renderSession([word('w1', 'apple'), word('w2', 'banana')]);
    // findByText/waitFor poll via a real-timer interval internally, which
    // never fires under vi.useFakeTimers() — flush the microtask chain
    // (getWord -> mapWithConcurrency -> setEligible/setPhase -> the options
    // effect) manually inside act() instead, then query synchronously.
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });
    return onComplete;
  };

  // Session order is shuffled (useVocabSession), so don't assume which word
  // is question 1 — read the answer back from the translation line, the one
  // piece of per-word text visible even though the sentence itself is blanked.
  const currentCorrectAnswer = (): 'apple' | 'banana' =>
    screen.queryByText(/Bản dịch của apple/) !== null ? 'apple' : 'banana';
  const otherAnswer = (a: 'apple' | 'banana'): 'apple' | 'banana' => (a === 'apple' ? 'banana' : 'apple');

  it('a correct selection locks the options and advances after the reveal delay', async () => {
    await setUpTwoWordSession();
    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    const correct = currentCorrectAnswer();

    fireEvent.click(screen.getByRole('button', { name: correct }));
    expect(screen.getByRole('button', { name: otherAnswer(correct) })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    expect(screen.getByText('Correct: 1')).toBeInTheDocument();
  });

  it('an incorrect selection locks the options and does not increment the correct count', async () => {
    await setUpTwoWordSession();
    const correct = currentCorrectAnswer();

    fireEvent.click(screen.getByRole('button', { name: otherAnswer(correct) }));

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    expect(screen.getByText('Correct: 0')).toBeInTheDocument();
  });

  it('completes the session and calls onComplete with the right totals', async () => {
    const onComplete = await setUpTwoWordSession();
    expect(screen.getByText('Question 1/2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: currentCorrectAnswer() }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: currentCorrectAnswer() }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onComplete).toHaveBeenCalledWith({ totalCards: 2, correctCount: 2 });
  });
});
