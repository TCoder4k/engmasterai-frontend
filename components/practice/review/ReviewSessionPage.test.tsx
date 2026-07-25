import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ReviewSessionPage from './ReviewSessionPage';

// getWord (examples) and getDueReviews/submitReview (real network calls) are
// mocked; isVersionConflict/isIdempotencyKeyReused stay real via
// importActual, matching FlashcardSession/DictationSession's spec convention.
vi.mock('../../../services/vocabWordService', () => ({ getWord: vi.fn() }));
vi.mock('../../../services/learningService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/learningService')>(
    '../../../services/learningService',
  );
  return { ...actual, getDueReviews: vi.fn(), submitReview: vi.fn() };
});

import { getWord } from '../../../services/vocabWordService';
import { getDueReviews, submitReview } from '../../../services/learningService';

interface QueueWord {
  id: string;
  text: string;
  ipa: string | null;
  cefrLevel: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  meanings: { id: string; partOfSpeech: string | null; meaning: string; orderIndex: number }[];
}

const word = (id: string, text: string): QueueWord => ({
  id,
  text,
  ipa: null,
  cefrLevel: null,
  audioUrl: null,
  imageUrl: null,
  meanings: [{ id: `m-${id}`, partOfSpeech: 'NOUN', meaning: `meaning of ${text}`, orderIndex: 0 }],
});

const queueItem = (id: string, text: string) => ({
  word: word(id, text),
  isNew: false,
  progress: {
    state: 'REVIEW' as const,
    intervalDays: 1,
    nextReviewAt: new Date().toISOString(),
    easeFactor: 2.5,
    repetitions: 1,
    lapses: 0,
  },
  previewIntervals: { again: 1, hard: 1, good: 1, easy: 4 },
});

const renderPage = (search = '') =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[`/practice/review${search}`]}>
          <Routes>
            <Route path="/practice/review" element={<ReviewSessionPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

// The flip card renders the word text on BOTH faces at once (only
// visually/AT-hidden via aria-hidden, matching FlashcardSession's own
// structure) — so a plain getByText/findByText on the word itself is
// always ambiguous. These helpers wait for/assert "at least one" instead.
const findWordShown = (text: string) => waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));
const expectWordShown = (text: string) => expect(screen.getAllByText(text).length).toBeGreaterThan(0);
const expectWordNotShown = (text: string) => expect(screen.queryAllByText(text)).toHaveLength(0);

/** Reveals the card so the rating buttons become actionable. */
const reveal = async () => {
  await userEvent.keyboard(' ');
};

const mockSubmitResult = (over: Record<string, unknown> = {}) => ({
  state: 'REVIEW',
  intervalDays: 1,
  nextReviewAt: new Date().toISOString(),
  easeFactor: 2.5,
  repetitions: 1,
  lapses: 0,
  version: 1,
  ...over,
});

beforeEach(() => {
  (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({ examples: [] });
  (submitReview as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmitResult());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReviewSessionPage', () => {
  it('shows an honest empty state when nothing is due', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });

  it('forwards deckId and libraryId from the URL to the due-queue request', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    renderPage('?deckId=deck-9&libraryId=lib-9');

    await waitFor(() =>
      expect(getDueReviews).toHaveBeenCalledWith(expect.objectContaining({ deckId: 'deck-9', libraryId: 'lib-9' })),
    );
  });

  it('renders the due word with real, backend-computed preview intervals', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [queueItem('w1', 'contract')] });
    renderPage();

    await findWordShown('contract');
    expect(screen.getByRole('button', { name: 'Good — 1 d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Easy — 4 d' })).toBeInTheDocument();
  });

  it('rating a word submits a real review with practiceMode REVIEW and advances to the next word', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [queueItem('w1', 'alpha'), queueItem('w2', 'beta')],
    });
    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'GOOD', practiceMode: 'REVIEW' }),
      ),
    );
    await findWordShown('beta');
  });

  // --- the reveal gate ---

  it('does not let a MOUSE user rate a card they have never revealed', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [queueItem('w1', 'alpha')] });
    renderPage();
    await findWordShown('alpha');

    // Previously only the keyboard path checked the reveal, so clicking here
    // submitted a rating for a card the user had not turned over.
    expect(screen.getByRole('button', { name: /^Good/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
    expect(submitReview).not.toHaveBeenCalled();

    await reveal();
    expect(screen.getByRole('button', { name: /^Good/ })).toBeEnabled();
  });

  it('flips via Space and rates via number keys only once flipped — never before, never on a Ctrl-modified key', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [queueItem('w1', 'alpha')] });
    renderPage();
    await findWordShown('alpha');

    await userEvent.keyboard('3'); // GOOD — must do nothing before the card is flipped
    expect(submitReview).not.toHaveBeenCalled();

    await userEvent.keyboard('{Control>}3{/Control}'); // Ctrl+3 must never be intercepted either
    expect(submitReview).not.toHaveBeenCalled();

    await reveal();
    await userEvent.keyboard('3'); // now GOOD is actionable
    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith('w1', expect.objectContaining({ rating: 'GOOD' })),
    );
  });

  // --- idempotency key stability ---

  it('reuses the SAME clientReviewId when retrying the same rating after a version conflict', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [queueItem('w1', 'alpha'), queueItem('w2', 'beta')],
    });
    const { ApiError } = await import('../../../services/apiError');
    (submitReview as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new ApiError('conflict', 409, 'VERSION_CONFLICT'))
      .mockResolvedValueOnce(mockSubmitResult());

    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(1));

    // Same word, same rating -> the retry must carry the ORIGINAL key, or the
    // backend cannot dedupe it and would apply the review twice.
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(2));

    const firstKey = (submitReview as ReturnType<typeof vi.fn>).mock.calls[0][1].clientReviewId;
    const secondKey = (submitReview as ReturnType<typeof vi.fn>).mock.calls[1][1].clientReviewId;
    expect(secondKey).toBe(firstKey);
    expect(firstKey).toBeTruthy();
  });

  it('mints a NEW clientReviewId when the user picks a different rating after a conflict', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [queueItem('w1', 'alpha'), queueItem('w2', 'beta')],
    });
    const { ApiError } = await import('../../../services/apiError');
    (submitReview as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new ApiError('conflict', 409, 'VERSION_CONFLICT'))
      .mockResolvedValueOnce(mockSubmitResult());

    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(1));

    // A different rating is a genuinely different intent — reusing the key
    // would make the backend replay the GOOD outcome and silently ignore it.
    await userEvent.click(screen.getByRole('button', { name: /^Easy/ }));
    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(2));

    const calls = (submitReview as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1][1].rating).toBe('EASY');
    expect(calls[1][1].clientReviewId).not.toBe(calls[0][1].clientReviewId);
  });

  it('mints a new clientReviewId for each successfully rated word', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [queueItem('w1', 'alpha'), queueItem('w2', 'beta')],
    });
    renderPage();

    await findWordShown('alpha');
    await reveal();
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await findWordShown('beta');
    await reveal();
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(2));
    const calls = (submitReview as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1][1].clientReviewId).not.toBe(calls[0][1].clientReviewId);
  });

  it('a version conflict does not advance the session or show a scary error — the user can just retry', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [queueItem('w1', 'alpha'), queueItem('w2', 'beta')],
    });
    const { ApiError } = await import('../../../services/apiError');
    (submitReview as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError('conflict', 409, 'VERSION_CONFLICT'),
    );
    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(1));
    expectWordShown('alpha'); // still on the same word
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces an idempotency-key-reuse 409 as a real error instead of silently retrying', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [queueItem('w1', 'alpha')] });
    const { ApiError } = await import('../../../services/apiError');
    (submitReview as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError('Duplicate review key', 409, 'IDEMPOTENCY_KEY_REUSED'),
    );
    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    // A client bug, not a transient condition — it must be visible.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  // --- AGAIN requeue: retrain-only (Option A) ---

  it('rating Again requeues the word as a RETRAIN card that submits no second review', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [queueItem('w1', 'alpha'), queueItem('w2', 'beta')],
    });
    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Again/ }));
    await findWordShown('beta');
    await reveal();
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    // alpha resurfaces...
    await findWordShown('alpha');
    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(2));

    // ...as extra practice: no rating buttons at all, and the number keys
    // are inert, so no second review can be submitted for it.
    expect(screen.getByText(/not scored again/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Good/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Again/ })).not.toBeInTheDocument();

    await reveal();
    await userEvent.keyboard('3');
    expect(submitReview).toHaveBeenCalledTimes(2); // still 2 — never a third

    // Only "Continue" advances it.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(submitReview).toHaveBeenCalledTimes(2);
  });

  it('counts a retrain pass separately from real reviews in the summary', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [queueItem('w1', 'alpha')] });
    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Again/ }));
    await findWordShown('alpha'); // requeued immediately (queue of one)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Review session complete!')).toBeInTheDocument();
    // 1 real review (the AGAIN), 1 retrain pass — never counted as 2 reviews.
    expect(screen.getByText('Practised again: 1')).toBeInTheDocument();
  });

  it('shows the real reviewed count, accuracy and rating breakdown once the queue is exhausted — no XP, no streak', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [queueItem('w1', 'alpha')] });
    renderPage();
    await findWordShown('alpha');
    await reveal();

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    expect(await screen.findByText('Review session complete!')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument(); // 1 reviewed, 0 again
    expect(screen.getByText('Your ratings')).toBeInTheDocument();
    expect(screen.queryByText(/\bXP\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expectWordNotShown('alpha'); // the flip card is gone, replaced by the summary
  });

  it('"Review more" actually refetches the queue and restarts the session', async () => {
    (getDueReviews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [queueItem('w1', 'alpha')] });
    renderPage();
    await findWordShown('alpha');
    await reveal();
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
    expect(await screen.findByText('Review session complete!')).toBeInTheDocument();

    // Previously the restart key sat on a child <div> while the hook lived in
    // the page, so nothing remounted and this button did nothing at all.
    await userEvent.click(screen.getByRole('button', { name: 'Review more' }));

    await waitFor(() => expect(getDueReviews).toHaveBeenCalledTimes(2));
    await findWordShown('alpha');
    expect(screen.queryByText('Review session complete!')).not.toBeInTheDocument();
  });
});
