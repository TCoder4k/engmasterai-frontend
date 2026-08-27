import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import WordDetailPage from './WordDetailPage';
import { VocabWordDetail } from '../../types';

vi.mock('../../services/vocabWordService', () => ({
  getWord: vi.fn(),
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

import { getWord } from '../../services/vocabWordService';
import {
  getPersonalVocabWordsSavedStatus,
  createPersonalVocabWord,
} from '../../services/vocabPersonalService';

const WORD: VocabWordDetail = {
  id: 'w1',
  text: 'abandon',
  ipa: null,
  audioUrl: null,
  imageUrl: null,
  cefrLevel: null,
  synonyms: [],
  antonyms: [],
  collocations: [],
  wordFamily: [],
  meanings: [{ id: 'm1', partOfSpeech: 'VERB', meaning: 'từ bỏ', orderIndex: 0 }],
  examples: [{ id: 'e1', sentence: 'Do not abandon hope.', translation: 'Đừng từ bỏ hy vọng.', orderIndex: 0 }],
};

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/vocab/words/w1']}>
          <Routes>
            <Route path="/vocab/words/:id" element={<WordDetailPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WordDetailPage — universal save-star', () => {
  it('saves the word (with its real example) via the header star', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue(WORD);
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ abandon: { saved: false } });
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'personal-1' });

    renderPage();
    await screen.findByText('abandon');

    const star = screen.getByRole('button', { name: 'Save to My Vocabulary' });
    await userEvent.click(star);

    await waitFor(() =>
      expect(createPersonalVocabWord).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'abandon',
          meaningVi: 'từ bỏ',
          exampleSentence: 'Do not abandon hope.',
          exampleTranslation: 'Đừng từ bỏ hy vọng.',
        }),
      ),
    );
    await screen.findByRole('button', { name: 'Remove from My Vocabulary' });
  });

  it('omits the star for a word with zero curated meanings', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({ ...WORD, meanings: [] });
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    renderPage();
    await screen.findByText('abandon');

    expect(screen.queryByRole('button', { name: 'Save to My Vocabulary' })).not.toBeInTheDocument();
  });
});
