import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import LibraryDetailPage from './LibraryDetailPage';

// LibraryDetailPage is the vocabulary learning overview: real library/deck
// data plus real Learning-Engine progress.
//
// Sprint 04D repair — what changed here and why:
//  * The "Progress tracking will be available in a later sprint" placeholder
//    is GONE. It used to render on first paint and permanently on any
//    progress-fetch failure, which made a working feature look unbuilt.
//    Loading / failed / genuinely-empty are now three distinct states.
//  * The whole deck row used to be one <Link> to Flashcard. It is now a
//    container with a separate name link and a separate action link, because
//    a <Link> cannot legally contain another <Link> and the action now
//    varies with real progress.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const MOCK_LIBRARY = {
  id: 'lib-1',
  name: 'TOEIC 600 Essential Words',
  description: '600 essential vocabulary words for TOEIC test preparation.',
  thumbnail: null,
  isPublished: true,
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const deck = (id: string, name: string, wordCount: number) => ({
  id,
  libraryId: 'lib-1',
  name,
  description: null,
  thumbnail: null,
  cefrLevel: 'B1',
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  _count: { deckWords: wordCount },
});

const MOCK_DECKS = [deck('deck-1', 'Contract', 15), deck('deck-2', 'Marketing', 13)];

const deckProgress = (deckId: string, over: Record<string, number> = {}) => ({
  deckId,
  totalWords: 10,
  newWords: 5,
  learningWords: 2,
  reviewWords: 2,
  masteredWords: 1,
  dueWords: 0,
  startedPercent: 50,
  masteredPercent: 10,
  ...over,
});

const renderPage = (path = '/vocab/libraries/lib-1') =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/vocab/libraries/:id" element={<LibraryDetailPage />} />
            <Route path="/practice/vocab/:deckId" element={<div>SESSION_PAGE_STUB</div>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

/** Builds a fetch mock; `progress` of `null` makes the progress call fail. */
const buildFetch = (progress: unknown | null, decks = MOCK_DECKS) =>
  vi.fn((url: string) => {
    if (url.includes('/learning/libraries/lib-1/progress')) {
      return Promise.resolve(
        progress === null ? jsonResponse(500, { message: 'boom' }) : jsonResponse(200, progress),
      );
    }
    if (url.includes('/vocab/libraries/lib-1/decks')) return Promise.resolve(jsonResponse(200, { data: decks }));
    if (url.includes('/vocab/libraries/lib-1')) return Promise.resolve(jsonResponse(200, MOCK_LIBRARY));
    if (url.includes('/vocab/libraries/missing-lib')) {
      return Promise.resolve(jsonResponse(404, { message: 'Vocabulary library with ID missing-lib not found' }));
    }
    return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LibraryDetailPage — content', () => {
  beforeEach(() => {
    global.fetch = buildFetch(null) as unknown as typeof fetch;
  });

  it('shows a loading state before data arrives', () => {
    renderPage();
    expect(screen.queryByText('TOEIC 600 Essential Words')).not.toBeInTheDocument();
  });

  it('renders real library data and real deck/word counts', async () => {
    renderPage();

    expect(await screen.findByText('TOEIC 600 Essential Words')).toBeInTheDocument();
    expect(screen.getByText('600 essential vocabulary words for TOEIC test preparation.')).toBeInTheDocument();
    // No progress loaded, so the header falls back to the summed deck counts.
    expect(screen.getByText('2 decks · 28 words')).toBeInTheDocument();
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('15 words')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('13 words')).toBeInTheDocument();
  });

  it('shows an empty state when the library has zero published decks', async () => {
    global.fetch = buildFetch(null, []) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText('No decks in this library yet.')).toBeInTheDocument();
  });

  it('shows a safe error state for an invalid/unpublished library ID (404)', async () => {
    renderPage('/vocab/libraries/missing-lib');
    expect(await screen.findByText('Vocabulary library with ID missing-lib not found')).toBeInTheDocument();
    expect(screen.getByText('Back to libraries')).toBeInTheDocument();
  });

  it('never renders the removed "later sprint" placeholder, in any state', async () => {
    renderPage();
    await screen.findByText('Contract');
    expect(screen.queryByText(/will be available in a later/i)).not.toBeInTheDocument();
  });

  it('says progress is unavailable — not "Not started" — when the progress fetch fails', async () => {
    renderPage();
    // "Not started" would be a claim about the student's behaviour; the real
    // situation is that we simply do not know.
    expect(await screen.findByText('Progress could not be loaded right now.')).toBeInTheDocument();
    expect(await screen.findAllByText('Progress unavailable')).toHaveLength(2);
    expect(screen.queryByText('Not started')).not.toBeInTheDocument();
  });

  it('still offers a Flashcard action for a non-empty deck when progress is unavailable', async () => {
    renderPage();
    const links = await screen.findAllByRole('link', { name: 'Start practice' });
    expect(links[0]).toHaveAttribute('href', '/practice/vocab/deck-1?mode=flashcard');
  });
});

describe('LibraryDetailPage — real progress', () => {
  it('shows both percentages separately — started (exposure) and mastered (quality)', async () => {
    global.fetch = buildFetch({
      libraryId: 'lib-1',
      totalWords: 28,
      newWords: 8,
      learningWords: 3,
      reviewWords: 15,
      masteredWords: 2,
      dueWords: 4,
      startedPercent: 71,
      masteredPercent: 7,
      decks: [deckProgress('deck-1'), deckProgress('deck-2')],
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('71%')).toBeInTheDocument();
    expect(screen.getByText('7%')).toBeInTheDocument();
    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.getByText('Mastered')).toBeInTheDocument();
  });

  it('uses the server distinct-word total in the header, not the sum of deck counts', async () => {
    // Decks report 15 + 13 = 28 attachments, but only 25 DISTINCT words —
    // three words live in both decks. The header must show the server's 25,
    // and explain the difference rather than letting it look like a bug.
    global.fetch = buildFetch({
      libraryId: 'lib-1',
      totalWords: 25,
      newWords: 25,
      learningWords: 0,
      reviewWords: 0,
      masteredWords: 0,
      dueWords: 0,
      startedPercent: 0,
      masteredPercent: 0,
      decks: [deckProgress('deck-1'), deckProgress('deck-2')],
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('2 decks · 25 words')).toBeInTheDocument();
    expect(screen.queryByText('2 decks · 28 words')).not.toBeInTheDocument();
    expect(screen.getByText(/can belong to more than one deck/i)).toBeInTheDocument();
  });

  it('links to the review session and labels the deck action "Review due words" when words are due', async () => {
    global.fetch = buildFetch({
      libraryId: 'lib-1',
      totalWords: 28,
      newWords: 8,
      learningWords: 3,
      reviewWords: 15,
      masteredWords: 2,
      dueWords: 4,
      startedPercent: 71,
      masteredPercent: 7,
      decks: [deckProgress('deck-1', { dueWords: 4 }), deckProgress('deck-2')],
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByRole('link', { name: /4 words due for review/i })).toHaveAttribute(
      'href',
      '/practice/review?libraryId=lib-1',
    );
    expect(screen.getByRole('link', { name: 'Review due words' })).toHaveAttribute(
      'href',
      '/practice/review?deckId=deck-1',
    );
  });

  it('derives each deck action from that deck’s own real counts', async () => {
    global.fetch = buildFetch({
      libraryId: 'lib-1',
      totalWords: 28,
      newWords: 10,
      learningWords: 0,
      reviewWords: 8,
      masteredWords: 10,
      dueWords: 0,
      startedPercent: 64,
      masteredPercent: 35,
      decks: [
        // Untouched -> Start practice.
        deckProgress('deck-1', { totalWords: 10, newWords: 10, learningWords: 0, reviewWords: 0, masteredWords: 0 }),
        // Fully mastered -> Practice again.
        deckProgress('deck-2', { totalWords: 10, newWords: 0, learningWords: 0, reviewWords: 0, masteredWords: 10 }),
      ],
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByRole('link', { name: 'Start practice' })).toHaveAttribute(
      'href',
      '/practice/vocab/deck-1?mode=flashcard',
    );
    expect(screen.getByRole('link', { name: 'Practice again' })).toHaveAttribute(
      'href',
      '/practice/vocab/deck-2?mode=flashcard',
    );
  });

  it('labels a partially-studied deck "Continue practice"', async () => {
    global.fetch = buildFetch({
      libraryId: 'lib-1',
      totalWords: 10,
      newWords: 5,
      learningWords: 2,
      reviewWords: 2,
      masteredWords: 1,
      dueWords: 0,
      startedPercent: 50,
      masteredPercent: 10,
      decks: [deckProgress('deck-1')],
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByRole('link', { name: 'Continue practice' })).toBeInTheDocument();
  });

  it('shows an honest empty message, not 0%, for a library with no words', async () => {
    global.fetch = buildFetch({
      libraryId: 'lib-1',
      totalWords: 0,
      newWords: 0,
      learningWords: 0,
      reviewWords: 0,
      masteredWords: 0,
      dueWords: 0,
      startedPercent: 0,
      masteredPercent: 0,
      decks: [],
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText('No words in this library yet.')).toBeInTheDocument();
    expect(screen.queryByText('Started')).not.toBeInTheDocument();
  });

  it('the deck name links to the deck detail page, separately from the action', async () => {
    global.fetch = buildFetch({
      libraryId: 'lib-1',
      totalWords: 10,
      newWords: 5,
      learningWords: 2,
      reviewWords: 2,
      masteredWords: 1,
      dueWords: 0,
      startedPercent: 50,
      masteredPercent: 10,
      decks: [deckProgress('deck-1')],
    }) as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByRole('link', { name: 'Contract' })).toHaveAttribute('href', '/vocab/decks/deck-1');
  });

  it('a deck action is keyboard-activatable and lands on the Flashcard session', async () => {
    global.fetch = buildFetch(null) as unknown as typeof fetch;
    renderPage();

    const actions = await screen.findAllByRole('link', { name: 'Start practice' });
    actions[0].focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('SESSION_PAGE_STUB')).toBeInTheDocument());
  });
});
