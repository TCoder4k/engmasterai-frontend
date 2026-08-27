import { describe, it, expect, vi, afterEach } from 'vitest';
import { toggleSavedWord } from './saveWordAction';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/vocabPersonalService', () => ({
  createPersonalVocabWord: vi.fn(),
  deletePersonalVocabWord: vi.fn(),
  getPersonalVocabWordsSavedStatus: vi.fn(),
}));

import {
  createPersonalVocabWord,
  deletePersonalVocabWord,
  getPersonalVocabWordsSavedStatus,
} from '../../../services/vocabPersonalService';

const WORD = { text: 'apple', meaningVi: 'quả táo' };

afterEach(() => vi.clearAllMocks());

describe('toggleSavedWord', () => {
  it('saves an unsaved word by creating it', async () => {
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-id' });

    const result = await toggleSavedWord(WORD, null, 'confirm?');

    expect(createPersonalVocabWord).toHaveBeenCalledWith(WORD);
    expect(result).toEqual({ action: 'saved', id: 'new-id' });
  });

  it('unsaves an already-saved word after the user confirms', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (deletePersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await toggleSavedWord(WORD, 'existing-id', 'confirm?');

    expect(window.confirm).toHaveBeenCalledWith('confirm?');
    expect(deletePersonalVocabWord).toHaveBeenCalledWith('existing-id');
    expect(result).toEqual({ action: 'unsaved' });
  });

  it('does nothing and reports "cancelled" when the user declines the unsave confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const result = await toggleSavedWord(WORD, 'existing-id', 'confirm?');

    expect(deletePersonalVocabWord).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'cancelled' });
  });

  it('recovers the real id via a status re-check on a genuine 409 WORD_ALREADY_EXISTS race, instead of throwing', async () => {
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError('already exists', 409, 'WORD_ALREADY_EXISTS'),
    );
    (getPersonalVocabWordsSavedStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      apple: { saved: true, id: 'raced-id' },
    });

    const result = await toggleSavedWord(WORD, null, 'confirm?');

    expect(getPersonalVocabWordsSavedStatus).toHaveBeenCalledWith(['apple']);
    expect(result).toEqual({ action: 'saved', id: 'raced-id' });
  });

  it('rethrows any other error unchanged', async () => {
    const boom = new ApiError('server error', 500);
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockRejectedValue(boom);

    await expect(toggleSavedWord(WORD, null, 'confirm?')).rejects.toBe(boom);
  });
});
