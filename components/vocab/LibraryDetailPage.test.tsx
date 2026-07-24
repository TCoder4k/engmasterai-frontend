import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import LibraryDetailPage from './LibraryDetailPage';

// Sprint 03D — LibraryDetailPage is now the main vocabulary learning
// overview: real library/deck data only, honest empty/provisional states
// for anything not backed by a persisted-progress backend (none exists —
// see docs/memory.md), and each deck row goes straight to Flashcard mode.
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

const MOCK_DECKS = [
  {
    id: 'deck-1',
    libraryId: 'lib-1',
    name: 'Contract',
    description: null,
    thumbnail: null,
    cefrLevel: 'B1',
    orderIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { deckWords: 15 },
  },
  {
    id: 'deck-2',
    libraryId: 'lib-1',
    name: 'Marketing',
    description: null,
    thumbnail: null,
    cefrLevel: 'B1',
    orderIndex: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { deckWords: 13 },
  },
];

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

describe('LibraryDetailPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((url: string) => {
      if (url.includes('/vocab/libraries/lib-1/decks')) {
        return Promise.resolve(jsonResponse(200, { data: MOCK_DECKS }));
      }
      if (url.includes('/vocab/libraries/lib-1')) {
        return Promise.resolve(jsonResponse(200, MOCK_LIBRARY));
      }
      if (url.includes('/vocab/libraries/missing-lib')) {
        return Promise.resolve(
          jsonResponse(404, { message: 'Vocabulary library with ID missing-lib not found' }),
        );
      }
      return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a loading state before data arrives', () => {
    renderPage();
    // Skeleton placeholders render immediately; the real title has not
    // appeared yet.
    expect(screen.queryByText('TOEIC 600 Essential Words')).not.toBeInTheDocument();
  });

  it('renders real library data and real deck/word counts, with no fabricated progress numbers', async () => {
    renderPage();

    expect(await screen.findByText('TOEIC 600 Essential Words')).toBeInTheDocument();
    expect(
      screen.getByText('600 essential vocabulary words for TOEIC test preparation.'),
    ).toBeInTheDocument();

    // Real deck count (2) and real summed word count (15 + 13 = 28) — exact
    // string match on the single leaf element that renders this line, so
    // the assertion can't accidentally match an ancestor's longer text.
    expect(screen.getByText('2 decks · 28 words')).toBeInTheDocument();

    // Real per-deck word counts (each its own leaf <span>).
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('15 words')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('13 words')).toBeInTheDocument();

    // Honest empty/provisional states — never a fake percentage or
    // mastered/learning count, since no SRS backend exists yet.
    expect(
      screen.getByText('Progress tracking will be available in a later learning-engine sprint.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Not started')).toHaveLength(2);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/mastered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bXP\b/)).not.toBeInTheDocument();
  });

  it('shows an empty state when the library has zero published decks', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/vocab/libraries/lib-1/decks')) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      return Promise.resolve(jsonResponse(200, MOCK_LIBRARY));
    });

    renderPage();

    expect(await screen.findByText('No decks in this library yet.')).toBeInTheDocument();
  });

  it('shows a safe error state for an invalid/unpublished library ID (404)', async () => {
    renderPage('/vocab/libraries/missing-lib');

    expect(
      await screen.findByText('Vocabulary library with ID missing-lib not found'),
    ).toBeInTheDocument();
    // No crash — the page shell (back link) still renders.
    expect(screen.getByText('Back to libraries')).toBeInTheDocument();
  });

  it('a deck action navigates directly to Flashcard mode, not the generic Practice Hub', async () => {
    renderPage();

    const deckLink = await screen.findByRole('link', { name: /contract/i });
    expect(deckLink).toHaveAttribute('href', '/practice/vocab/deck-1?mode=flashcard');
  });

  it('a deck row is keyboard-activatable and lands on the Flashcard session', async () => {
    renderPage();

    const deckLink = await screen.findByRole('link', { name: /contract/i });
    deckLink.focus();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByText('SESSION_PAGE_STUB')).toBeInTheDocument();
  });
});
