import { ApiError } from '../../../services/apiError';
import {
  createPersonalVocabWord,
  deletePersonalVocabWord,
  getPersonalVocabWordsSavedStatus,
  CreatePersonalVocabWordInput,
} from '../../../services/vocabPersonalService';

export type ToggleSavedWordResult =
  | { action: 'saved'; id: string }
  | { action: 'unsaved' }
  | { action: 'cancelled' };

// Shared save/unsave logic behind the universal star — every SaveWordStar
// call site (DictionaryPanel, DeckDetailPage, WordDetailPage,
// FlashcardSession, PersonalWordListTab) drives this same function rather
// than each re-implementing its own create/confirm/delete flow.
export async function toggleSavedWord(
  word: CreatePersonalVocabWordInput,
  existingId: string | null,
  confirmMessage: string,
): Promise<ToggleSavedWordResult> {
  if (existingId) {
    if (!window.confirm(confirmMessage)) return { action: 'cancelled' };
    await deletePersonalVocabWord(existingId);
    return { action: 'unsaved' };
  }

  try {
    const created = await createPersonalVocabWord(word);
    return { action: 'saved', id: created.id };
  } catch (error) {
    // A genuine race — another tab/surface saved this exact word between
    // this component's last status check and this click (see
    // PersonalWordAlreadyExistsException on the backend). Recover the real
    // id via a fresh single-word status check rather than surfacing an
    // error for something that isn't the user's fault.
    if (error instanceof ApiError && error.status === 409 && error.code === 'WORD_ALREADY_EXISTS') {
      const status = await getPersonalVocabWordsSavedStatus([word.text]);
      const entry = Object.values(status)[0];
      if (entry?.saved) return { action: 'saved', id: entry.id };
    }
    throw error;
  }
}
