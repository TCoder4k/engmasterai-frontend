import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import MyVocabularyPage from './MyVocabularyPage';
import { PersonalVocabStats, PersonalVocabWord } from '../../services/vocabPersonalService';

vi.mock('../../services/vocabPersonalService', async () => {
  const actual = await vi.importActual<typeof import('../../services/vocabPersonalService')>(
    '../../services/vocabPersonalService',
  );
  return {
    ...actual,
    getPersonalVocabStats: vi.fn(),
    getPersonalVocabWords: vi.fn(),
    getAllPersonalVocabWords: vi.fn(),
  };
});

import {
  getPersonalVocabStats,
  getPersonalVocabWords,
  getAllPersonalVocabWords,
} from '../../services/vocabPersonalService';

// Deliberately no overlapping numbers anywhere in this fixture: the stat
// cards, and the chart's one direct value-label (the peak day only — see
// PersonalVocabStatsChart's selective-labeling comment), must never collide,
// or a query for one number ambiguously matches both.
const stats = (overrides: Partial<PersonalVocabStats> = {}): PersonalVocabStats => ({
  total: 12,
  mastered: 8,
  learning: 6,
  new: 4,
  dueTodayCount: 2,
  struggledCount: 1,
  reviewsLast7Days: [
    { date: '2026-08-21', count: 0 },
    { date: '2026-08-22', count: 1 },
    { date: '2026-08-23', count: 0 },
    { date: '2026-08-24', count: 2 },
    { date: '2026-08-25', count: 0 },
    { date: '2026-08-26', count: 1 },
    { date: '2026-08-27', count: 9 },
  ],
  ...overrides,
});

const wordRow = (id: string, text: string): PersonalVocabWord => ({
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

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter>
          <MyVocabularyPage />
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MyVocabularyPage', () => {
  it('renders real stat-card numbers from GET /vocab-personal/stats', async () => {
    (getPersonalVocabStats as ReturnType<typeof vi.fn>).mockResolvedValue(stats());
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    renderPage();

    expect(await screen.findByText('12')).toBeInTheDocument(); // Total saved
    expect(screen.getByText('8')).toBeInTheDocument(); // Mastered
    expect(screen.getByText('6')).toBeInTheDocument(); // Learning
    expect(screen.getByText('4')).toBeInTheDocument(); // Not learned yet
  });

  it('shows the sidebar "start review" action only when there are words due today', async () => {
    (getPersonalVocabStats as ReturnType<typeof vi.fn>).mockResolvedValue(stats({ dueTodayCount: 3 }));
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Start review' })).toBeInTheDocument();
  });

  it('shows the "all caught up" message when nothing is due and nothing is struggled', async () => {
    (getPersonalVocabStats as ReturnType<typeof vi.fn>).mockResolvedValue(
      stats({ dueTodayCount: 0, struggledCount: 0 }),
    );
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    renderPage();

    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument();
  });

  it('switching to the Flashcards tab fetches every saved word and starts a session', async () => {
    (getPersonalVocabStats as ReturnType<typeof vi.fn>).mockResolvedValue(stats());
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    (getAllPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue([wordRow('a', 'apple')]);
    renderPage();
    await screen.findByText('12');

    await userEvent.click(screen.getByRole('tab', { name: 'Flashcards' }));

    await waitFor(() => expect(getAllPersonalVocabWords).toHaveBeenCalledWith({}));
    // Both flip-card faces render the word text simultaneously (see
    // PersonalFlashcardSession's own comment on why) — at least one match
    // is enough to prove the session actually started with the fetched word.
    expect((await screen.findAllByText('apple')).length).toBeGreaterThan(0);
  });

  it('clicking "Start review" fetches only due words (dueOnly: true)', async () => {
    (getPersonalVocabStats as ReturnType<typeof vi.fn>).mockResolvedValue(stats({ dueTodayCount: 1 }));
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    (getAllPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue([wordRow('a', 'apple')]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Start review' }));

    await waitFor(() =>
      expect(getAllPersonalVocabWords).toHaveBeenCalledWith(expect.objectContaining({ dueOnly: true })),
    );
  });
});
