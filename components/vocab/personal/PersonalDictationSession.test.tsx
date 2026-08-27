import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import PersonalDictationSession from './PersonalDictationSession';
import { PersonalVocabWord } from '../../../services/vocabPersonalService';

vi.mock('../../../services/vocabPersonalService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/vocabPersonalService')>(
    '../../../services/vocabPersonalService',
  );
  return { ...actual, submitPersonalWordReview: vi.fn() };
});

import { submitPersonalWordReview } from '../../../services/vocabPersonalService';

const word = (id: string, text: string): PersonalVocabWord => ({
  id,
  text,
  ipa: null,
  meaningVi: `nghĩa của ${text}`,
  meaningEn: null,
  audioUrl: null,
  exampleSentence: null,
  exampleTranslation: null,
  tags: [],
  state: 'NEW',
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
  nextReviewAt: null,
  firstLearnedAt: null,
  masteredAt: null,
  version: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const renderSession = (words: PersonalVocabWord[], onComplete = vi.fn()) => {
  render(
    <LanguageProvider>
      <PersonalDictationSession words={words} onComplete={onComplete} />
    </LanguageProvider>,
  );
  return onComplete;
};

beforeEach(() => {
  (submitPersonalWordReview as ReturnType<typeof vi.fn>).mockResolvedValue({
    state: 'REVIEW',
    intervalDays: 1,
    nextReviewAt: new Date().toISOString(),
    easeFactor: 2.5,
    repetitions: 1,
    lapses: 0,
    version: 1,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PersonalDictationSession', () => {
  it('checks the typed answer, suggests Good on a correct answer, and confirming it calls the personal review endpoint', async () => {
    renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() =>
      expect(submitPersonalWordReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'GOOD' }),
      ),
    );
  });

  it('an incorrect answer suggests AGAIN and shows the real meaning (not a curated-deck one)', async () => {
    renderSession([word('w1', 'alpha')]);

    await userEvent.type(screen.getByLabelText('Type what you hear'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText('nghĩa của alpha')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Again/ }));
    await waitFor(() =>
      expect(submitPersonalWordReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'AGAIN' }),
      ),
    );
  });

  it('advances through every word and completes with the right totals', async () => {
    const onComplete = renderSession([word('w1', 'alpha'), word('w2', 'beta')]);

    for (const text of ['alpha', 'beta']) {
      const input = screen.getByLabelText('Type what you hear');
      await userEvent.type(input, text);
      await userEvent.click(screen.getByRole('button', { name: 'Check' }));
      await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
      await waitFor(() => expect(submitPersonalWordReview).toHaveBeenCalled());
      (submitPersonalWordReview as ReturnType<typeof vi.fn>).mockClear();
    }

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 2, correctCount: 2 }));
  });
});
