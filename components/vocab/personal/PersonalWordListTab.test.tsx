import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import PersonalWordListTab from './PersonalWordListTab';
import { PersonalVocabWord } from '../../../services/vocabPersonalService';

vi.mock('../../../services/vocabPersonalService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/vocabPersonalService')>(
    '../../../services/vocabPersonalService',
  );
  return { ...actual, getPersonalVocabWords: vi.fn(), deletePersonalVocabWord: vi.fn() };
});

import { getPersonalVocabWords, deletePersonalVocabWord } from '../../../services/vocabPersonalService';

const wordRow = (overrides: Partial<PersonalVocabWord> = {}): PersonalVocabWord => ({
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

const listResponse = (data: PersonalVocabWord[]) => ({
  data,
  meta: { total: data.length, page: 1, limit: 20, totalPages: 1 },
});

const renderTab = (refreshToken = 0) =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <PersonalWordListTab refreshToken={refreshToken} />
      </MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PersonalWordListTab', () => {
  it('renders the fetched words', async () => {
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue(listResponse([wordRow()]));
    renderTab();

    expect(await screen.findByText('abandon')).toBeInTheDocument();
    expect(screen.getByText('từ bỏ')).toBeInTheDocument();
  });

  it('shows the empty state when there are no words at all', async () => {
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue(listResponse([]));
    renderTab();

    expect(await screen.findByText("You haven't saved any words yet.")).toBeInTheDocument();
  });

  it('re-fetches with the search term after the debounce', async () => {
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue(listResponse([wordRow()]));
    renderTab();
    await waitFor(() => expect(getPersonalVocabWords).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByPlaceholderText('Search your words...'), 'aban');

    await waitFor(() =>
      expect(getPersonalVocabWords).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'aban', page: 1 })),
    );
  });

  it('deleting a word (after confirming) calls the delete endpoint and removes it from the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue(listResponse([wordRow()]));
    (deletePersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    renderTab();

    await screen.findByText('abandon');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletePersonalVocabWord).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(screen.queryByText('abandon')).not.toBeInTheDocument());
  });

  it('does not delete when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue(listResponse([wordRow()]));
    renderTab();

    await screen.findByText('abandon');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deletePersonalVocabWord).not.toHaveBeenCalled();
  });

  it('refetches when refreshToken changes', async () => {
    (getPersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue(listResponse([wordRow()]));
    const { rerender } = renderTab(0);
    await waitFor(() => expect(getPersonalVocabWords).toHaveBeenCalledTimes(1));

    rerender(
      <LanguageProvider>
        <MemoryRouter>
          <PersonalWordListTab refreshToken={1} />
        </MemoryRouter>
      </LanguageProvider>,
    );

    await waitFor(() => expect(getPersonalVocabWords).toHaveBeenCalledTimes(2));
  });
});
