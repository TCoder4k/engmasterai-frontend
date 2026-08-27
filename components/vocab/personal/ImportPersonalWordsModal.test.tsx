import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import ImportPersonalWordsModal from './ImportPersonalWordsModal';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/dictionaryService', () => ({
  lookupWord: vi.fn(),
}));
vi.mock('../../../services/vocabPersonalService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/vocabPersonalService')>(
    '../../../services/vocabPersonalService',
  );
  return { ...actual, bulkCreatePersonalVocabWords: vi.fn() };
});

import { lookupWord } from '../../../services/dictionaryService';
import { bulkCreatePersonalVocabWords } from '../../../services/vocabPersonalService';

const lookupResult = (word: string, meaning: string) => ({
  word,
  normalizedWord: word.toLowerCase(),
  ipa: null,
  audioUrl: null,
  meanings: [],
  synonyms: [],
  viTranslation: meaning,
  viTranslationSource: 'AI',
  sourceUrl: null,
  source: 'EXTERNAL',
  vocabWordId: null,
});

const renderModal = () => {
  const onClose = vi.fn();
  const onImported = vi.fn();
  render(
    <LanguageProvider>
      <ImportPersonalWordsModal onClose={onClose} onImported={onImported} />
    </LanguageProvider>,
  );
  return { onClose, onImported };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('ImportPersonalWordsModal', () => {
  it('looks up each pasted line sequentially, then lets the student review and submit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (lookupWord as ReturnType<typeof vi.fn>).mockImplementation((word: string) =>
      Promise.resolve(lookupResult(word, `nghĩa của ${word}`)),
    );
    renderModal();

    await act(async () => {
      await userEvent.type(
        screen.getByPlaceholderText(/abandon/),
        'apple{enter}banana',
        { delay: null },
      );
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Save these words' }));
    });

    // First lookup resolves quickly; the throttle then waits ~1.5s before
    // the second one fires.
    await waitFor(() => expect(lookupWord).toHaveBeenCalledWith('apple'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(lookupWord).toHaveBeenCalledWith('banana'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(await screen.findByText('Review before saving')).toBeInTheDocument();
    expect(screen.getByDisplayValue('nghĩa của apple')).toBeInTheDocument();
    expect(screen.getByDisplayValue('nghĩa của banana')).toBeInTheDocument();
  });

  it('a genuine miss (404) leaves that word unresolved-but-editable without stopping the batch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (lookupWord as ReturnType<typeof vi.fn>).mockImplementation((word: string) =>
      word === 'zzzznotaword'
        ? Promise.reject(new ApiError('not found', 404))
        : Promise.resolve(lookupResult(word, `nghĩa của ${word}`)),
    );
    renderModal();

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText(/abandon/), 'zzzznotaword{enter}apple', {
        delay: null,
      });
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Save these words' }));
    });

    await waitFor(() => expect(lookupWord).toHaveBeenCalledWith('zzzznotaword'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(lookupWord).toHaveBeenCalledWith('apple'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await screen.findByText('Review before saving');
    // The unresolved row's meaning field is empty (not auto-filled) and
    // shows the "not found" placeholder — but the row is still editable and
    // the batch continued to the second word regardless.
    expect(screen.getByPlaceholderText('Not found — you can still edit and save it')).toBeInTheDocument();
    expect(screen.getByDisplayValue('nghĩa của apple')).toBeInTheDocument();
  });

  it('a 429 mid-batch pauses and retries that same word rather than treating it as a permanent failure', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let callCount = 0;
    (lookupWord as ReturnType<typeof vi.fn>).mockImplementation((word: string) => {
      callCount += 1;
      if (word === 'apple' && callCount === 1) {
        return Promise.reject(new ApiError('rate limited', 429));
      }
      return Promise.resolve(lookupResult(word, `nghĩa của ${word}`));
    });
    renderModal();

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText(/abandon/), 'apple', { delay: null });
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Save these words' }));
    });

    expect(await screen.findByText(/pausing briefly/i)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000); // past the 5s backoff
    });

    await waitFor(() => expect(lookupWord).toHaveBeenCalledTimes(2)); // retried, not given up after one 429
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(await screen.findByDisplayValue('nghĩa của apple')).toBeInTheDocument();
  });

  it('submitting calls bulkCreatePersonalVocabWords and shows the created/skipped result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (lookupWord as ReturnType<typeof vi.fn>).mockImplementation((word: string) =>
      Promise.resolve(lookupResult(word, `nghĩa của ${word}`)),
    );
    (bulkCreatePersonalVocabWords as ReturnType<typeof vi.fn>).mockResolvedValue({
      createdCount: 1,
      skippedCount: 0,
      skippedWords: [],
    });
    const { onImported } = renderModal();

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText(/abandon/), 'apple', { delay: null });
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Save these words' }));
    });
    await waitFor(() => expect(lookupWord).toHaveBeenCalledWith('apple'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await screen.findByText('Review before saving');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Save these words' }));
    });

    await waitFor(() =>
      expect(bulkCreatePersonalVocabWords).toHaveBeenCalledWith([
        expect.objectContaining({ text: 'apple', meaningVi: 'nghĩa của apple' }),
      ]),
    );
    expect(await screen.findByText(/1 words added/)).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();
  });
});
