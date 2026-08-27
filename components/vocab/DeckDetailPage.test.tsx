import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import DeckDetailPage from './DeckDetailPage';
import { VocabDeck, VocabWordListItem } from '../../types';

vi.mock('../../services/vocabDeckService', () => ({
  getPublishedDeck: vi.fn(),
  getPublishedDeckWords: vi.fn(),
}));
vi.mock('../../services/learningService', () => ({
  getDeckProgress: vi.fn(),
}));
vi.mock('../../services/vocabPersonalService', async () => {
  const actual = await vi.importActual<typeof import('../../services/vocabPersonalService')>(
    '../../services/vocabPersonalService',
  );
  return {
    ...actual,
    getPersonalVocabWordsSavedStatus: vi.fn(),
    createPersonalVocabWord: vi.fn(),
    deletePersonalVocabWord: vi.fn(),
  };
});

import { getPublishedDeck, getPublishedDeckWords } from '../../services/vocabDeckService';
import { getDeckProgress } from '../../services/learningService';
import {
  getPersonalVocabWordsSavedStatus,
  createPersonalVocabWord,
  deletePersonalVocabWord,
} from '../../services/vocabPersonalService';

const DECK: VocabDeck = {
  id: 'deck-1',
  libraryId: 'lib-1',
  name: 'Everyday Verbs',
  description: null,
  thumbnail: null,
  cefrLevel: null,
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  _count: { deckWords: 1 },
};

const wordItem = (overrides: Partial<VocabWordListItem> = {}): VocabWordListItem => ({
  id: 'w1',
  text: 'abandon',
  ipa: null,
  cefrLevel: null,
  audioUrl: null,
  imageUrl: null,
  meanings: [{ id: 'm1', partOfSpeech: 'VERB', meaning: 'từ bỏ', orderIndex: 0 }],
  ...overrides,
});

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/vocab/decks/deck-1']}>
          <Routes>
            <Route path="/vocab/decks/:id" element={<DeckDetailPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DeckDetailPage — universal save-star', () => {
  it('shows an unsaved star for a word not yet in My Vocabulary, and saves it on click', async () => {
    (getPublishedDeck as ReturnType<typeof vi.fn>).mockResolvedValue(DECK);
    (getPublishedDeckWords as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [wordItem()] });
    (getDeckProgress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no progress'));
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ abandon: { saved: false } });
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'personal-1' });

    renderPage();
    await screen.findByText('abandon');

    const star = await screen.findByRole('button', { name: 'Save to My Vocabulary' });
    await userEvent.click(star);

    await waitFor(() =>
      expect(createPersonalVocabWord).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'abandon', meaningVi: 'từ bỏ' }),
      ),
    );
    await screen.findByRole('button', { name: 'Remove from My Vocabulary' });
  });

  it('shows an already-filled star for a word already in My Vocabulary, and unsaves it after confirming', async () => {
    (getPublishedDeck as ReturnType<typeof vi.fn>).mockResolvedValue(DECK);
    (getPublishedDeckWords as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [wordItem()] });
    (getDeckProgress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no progress'));
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      abandon: { saved: true, id: 'personal-1' },
    });
    (deletePersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    const star = await screen.findByRole('button', { name: 'Remove from My Vocabulary' });
    await userEvent.click(star);

    await waitFor(() => expect(deletePersonalVocabWord).toHaveBeenCalledWith('personal-1'));
    await screen.findByRole('button', { name: 'Save to My Vocabulary' });
  });

  it('omits the star for a word with zero curated meanings (cannot satisfy the required meaningVi)', async () => {
    (getPublishedDeck as ReturnType<typeof vi.fn>).mockResolvedValue(DECK);
    (getPublishedDeckWords as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [wordItem({ meanings: [] })],
    });
    (getDeckProgress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no progress'));
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    renderPage();
    await screen.findByText('abandon');

    expect(screen.queryByRole('button', { name: 'Save to My Vocabulary' })).not.toBeInTheDocument();
  });
});
