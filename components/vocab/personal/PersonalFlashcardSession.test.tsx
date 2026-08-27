import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import PersonalFlashcardSession from './PersonalFlashcardSession';
import { PersonalVocabWord } from '../../../services/vocabPersonalService';
import { ApiError } from '../../../services/apiError';

// submitPersonalWordReview is the one real network call this component
// makes — mocked the same way FlashcardSession.test.tsx mocks submitReview.
// isVersionConflict (a pure predicate over ApiError, no network) stays real
// via importActual.
vi.mock('../../../services/vocabPersonalService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/vocabPersonalService')>(
    '../../../services/vocabPersonalService',
  );
  return { ...actual, submitPersonalWordReview: vi.fn() };
});

vi.mock('../../../services/tts', async () => {
  const actual = await vi.importActual<typeof import('../../../services/tts')>('../../../services/tts');
  return { ...actual, speakText: vi.fn(() => true), cancelSpeech: vi.fn() };
});

import { submitPersonalWordReview } from '../../../services/vocabPersonalService';

const word = (overrides: Partial<PersonalVocabWord> = {}): PersonalVocabWord => ({
  id: 'w1',
  text: 'abandon',
  ipa: null,
  meaningVi: 'từ bỏ',
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
  ...overrides,
});

const renderSession = (words: PersonalVocabWord[], onComplete = vi.fn()) => {
  render(
    <LanguageProvider>
      <PersonalFlashcardSession words={words} onComplete={onComplete} />
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

describe('PersonalFlashcardSession', () => {
  it('flips to show the meaning, then rating GOOD calls the personal review endpoint (not the curated-deck one)', async () => {
    renderSession([word()]);

    await userEvent.click(screen.getByRole('button', { name: 'Tap the card to flip it' }));
    expect(screen.getByText('từ bỏ')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /good/i }));

    await waitFor(() =>
      expect(submitPersonalWordReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'GOOD' }),
      ),
    );
  });

  it('calls onComplete with the right totals once every card is rated', async () => {
    const onComplete = renderSession([word({ id: 'a' }), word({ id: 'b', text: 'resilient' })]);

    await userEvent.click(screen.getByRole('button', { name: /good/i }));
    await waitFor(() => expect(submitPersonalWordReview).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: /good/i }));
    await waitFor(() => expect(submitPersonalWordReview).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 2, correctCount: 2 }));
  });

  it('a version conflict does not surface a scary error message — the student can just rate again', async () => {
    (submitPersonalWordReview as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError('conflict', 409, 'VERSION_CONFLICT'),
    );
    renderSession([word()]);

    await userEvent.click(screen.getByRole('button', { name: /good/i }));

    await waitFor(() => expect(submitPersonalWordReview).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a genuine failure shows an inline error', async () => {
    (submitPersonalWordReview as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'));
    renderSession([word()]);

    await userEvent.click(screen.getByRole('button', { name: /good/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders nothing for an empty word list', () => {
    const { container } = render(
      <LanguageProvider>
        <PersonalFlashcardSession words={[]} onComplete={vi.fn()} />
      </LanguageProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
