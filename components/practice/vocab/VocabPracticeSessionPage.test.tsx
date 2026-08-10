import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import VocabPracticeSessionPage from './VocabPracticeSessionPage';

// Sprint 03D — Flashcard must be the canonical initial mode when a deck is
// opened from the vocabulary library page (no ?mode= param), and any
// invalid/unrecognized ?mode= value must fall back to it safely rather than
// landing on a blank/coming-soon state.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const MOCK_DECK = {
  id: 'deck-1',
  libraryId: 'lib-1',
  name: 'Contract',
  description: null,
  thumbnail: null,
  cefrLevel: 'B1',
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  _count: { deckWords: 2 },
};

const MOCK_LIBRARY = {
  id: 'lib-1',
  name: 'TOEIC 600 Essential Words',
  description: 'desc',
  thumbnail: null,
  isPublished: true,
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_WORDS = [
  {
    id: 'w1',
    text: 'contract',
    ipa: null,
    cefrLevel: null,
    audioUrl: null,
    imageUrl: null,
    meanings: [{ id: 'm1', partOfSpeech: 'NOUN', meaning: 'hợp đồng', orderIndex: 0 }],
  },
  {
    id: 'w2',
    text: 'agreement',
    ipa: null,
    cefrLevel: null,
    audioUrl: null,
    imageUrl: null,
    meanings: [{ id: 'm2', partOfSpeech: 'NOUN', meaning: 'thỏa thuận', orderIndex: 0 }],
  },
];

const renderSessionPage = (path: string) =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/practice/vocab/:deckId" element={<VocabPracticeSessionPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

describe('VocabPracticeSessionPage — canonical initial mode', () => {
  beforeEach(() => {
    const fetchMock = vi.fn((url: string) => {
      // Guess-the-Word's own persisted progress fetch (useGuessWordQueue) —
      // matched BEFORE the generic '/vocab/decks/deck-1' branch below, since
      // this URL contains that substring too. A shallow "nothing learned
      // yet" response is enough for this file's mechanism-level (tab-
      // selection) checks.
      if (url.includes('/guess-progress')) {
        return Promise.resolve(
          jsonResponse(200, { deckId: 'deck-1', totalWords: MOCK_WORDS.length, learnedWordIds: [] }),
        );
      }
      if (url.includes('/vocab/decks/deck-1/words')) {
        return Promise.resolve(jsonResponse(200, { data: MOCK_WORDS }));
      }
      if (url.includes('/vocab/decks/deck-1')) {
        return Promise.resolve(jsonResponse(200, MOCK_DECK));
      }
      if (url.includes('/vocab/libraries/lib-1')) {
        return Promise.resolve(jsonResponse(200, MOCK_LIBRARY));
      }
      // Guess-the-Word and Fill-in-the-Blank both lazily fetch per-word
      // examples the same way Flashcard does — a shallow, example-less 200
      // is enough for this file's mechanism-level checks.
      if (url.includes('/vocab/words/')) {
        return Promise.resolve(jsonResponse(200, { examples: [] }));
      }
      return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('selects Flashcard mode when opened with no ?mode= param', async () => {
    renderSessionPage('/practice/vocab/deck-1');

    const flashcardTab = await screen.findByRole('tab', { name: /flashcards/i });
    expect(flashcardTab).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to Flashcard mode for an unrecognized ?mode= value', async () => {
    renderSessionPage('/practice/vocab/deck-1?mode=bogus');

    const flashcardTab = await screen.findByRole('tab', { name: /flashcards/i });
    expect(flashcardTab).toHaveAttribute('aria-selected', 'true');
  });

  it('honors a valid ?mode=dictation param (mechanism sanity check)', async () => {
    renderSessionPage('/practice/vocab/deck-1?mode=dictation');

    const dictationTab = await screen.findByRole('tab', { name: /dictation/i });
    expect(dictationTab).toHaveAttribute('aria-selected', 'true');
    const flashcardTab = screen.getByRole('tab', { name: /flashcards/i });
    expect(flashcardTab).toHaveAttribute('aria-selected', 'false');
  });

  it('honors a valid ?mode=guess param (mechanism sanity check)', async () => {
    renderSessionPage('/practice/vocab/deck-1?mode=guess');

    const guessTab = await screen.findByRole('tab', { name: /guess the word/i });
    expect(guessTab).toHaveAttribute('aria-selected', 'true');
    const flashcardTab = screen.getByRole('tab', { name: /flashcards/i });
    expect(flashcardTab).toHaveAttribute('aria-selected', 'false');
  });

  it('honors a valid ?mode=contextual param (mechanism sanity check)', async () => {
    renderSessionPage('/practice/vocab/deck-1?mode=contextual');

    const contextualTab = await screen.findByRole('tab', { name: /fill in the blank/i });
    expect(contextualTab).toHaveAttribute('aria-selected', 'true');
    const flashcardTab = screen.getByRole('tab', { name: /flashcards/i });
    expect(flashcardTab).toHaveAttribute('aria-selected', 'false');
  });
});
