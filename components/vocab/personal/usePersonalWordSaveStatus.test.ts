import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePersonalWordSaveStatus } from './usePersonalWordSaveStatus';

vi.mock('../../../services/vocabPersonalService', () => ({
  getPersonalVocabWordsSavedStatus: vi.fn(),
}));

import { getPersonalVocabWordsSavedStatus } from '../../../services/vocabPersonalService';

afterEach(() => vi.clearAllMocks());

describe('usePersonalWordSaveStatus', () => {
  it('issues no network call and reports everything unsaved for an empty word list', () => {
    const { result } = renderHook(() => usePersonalWordSaveStatus([]));

    expect(getPersonalVocabWordsSavedStatus).not.toHaveBeenCalled();
    expect(result.current.isSaved('apple')).toBe(false);
  });

  it('batch-checks once and reflects saved/unsaved per word, case/whitespace-insensitively', async () => {
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      apple: { saved: true, id: 'w1' },
      banana: { saved: false },
    });

    const { result } = renderHook(() => usePersonalWordSaveStatus(['Apple', 'banana']));

    await waitFor(() => expect(result.current.isSaved('  APPLE  ')).toBe(true));
    expect(result.current.getSavedId('apple')).toBe('w1');
    expect(result.current.isSaved('banana')).toBe(false);
    expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-fetch when re-rendered with a new array of the SAME word set (the exact N+1-per-render bug this hook exists to avoid)', async () => {
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      apple: { saved: false },
    });

    const { rerender } = renderHook(({ texts }) => usePersonalWordSaveStatus(texts), {
      initialProps: { texts: ['apple'] },
    });
    await waitFor(() => expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledTimes(1));

    // A brand-new array reference, same content — exactly what
    // `words.map(w => w.text)` produces on every render.
    rerender({ texts: ['apple'] });
    rerender({ texts: ['apple'] });

    // Give any errant effect a tick to fire before asserting it didn't.
    await new Promise((r) => setTimeout(r, 0));
    expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledTimes(1);
  });

  it('DOES re-fetch when the underlying word set actually changes', async () => {
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { rerender } = renderHook(({ texts }) => usePersonalWordSaveStatus(texts), {
      initialProps: { texts: ['apple'] },
    });
    await waitFor(() => expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledTimes(1));

    rerender({ texts: ['banana'] });

    await waitFor(() => expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledTimes(2));
    expect(getPersonalVocabWordsSavedStatus).toHaveBeenLastCalledWith(['banana']);
  });

  it('markSaved/markUnsaved update local state immediately without a new fetch', async () => {
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      apple: { saved: false },
    });
    const { result } = renderHook(() => usePersonalWordSaveStatus(['apple']));
    await waitFor(() => expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledTimes(1));

    act(() => result.current.markSaved('apple', 'new-id'));
    expect(result.current.isSaved('apple')).toBe(true);
    expect(result.current.getSavedId('apple')).toBe('new-id');

    act(() => result.current.markUnsaved('apple'));
    expect(result.current.isSaved('apple')).toBe(false);

    expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledTimes(1);
  });
});
