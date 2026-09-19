import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import AddPersonalWordModal from './AddPersonalWordModal';
import { PersonalVocabWord } from '../../../services/vocabPersonalService';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/dictionaryService', () => ({
  lookupWord: vi.fn(),
}));
vi.mock('../../../services/vocabPersonalService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/vocabPersonalService')>(
    '../../../services/vocabPersonalService',
  );
  return { ...actual, createPersonalVocabWord: vi.fn(), updatePersonalVocabWord: vi.fn() };
});

import { lookupWord } from '../../../services/dictionaryService';
import {
  createPersonalVocabWord,
  updatePersonalVocabWord,
} from '../../../services/vocabPersonalService';

const existingWord = (overrides: Partial<PersonalVocabWord> = {}): PersonalVocabWord => ({
  id: 'w1',
  text: 'abandon',
  ipa: 'əˈbændən',
  meaningVi: 'từ bỏ',
  meaningEn: 'to give up',
  audioUrl: null,
  exampleSentence: null,
  exampleTranslation: null,
  tags: ['TOEIC'],
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

const renderModal = (props: { editingWord?: PersonalVocabWord } = {}) => {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <MemoryRouter>
      <LanguageProvider>
        <AddPersonalWordModal onClose={onClose} onCreated={onCreated} editingWord={props.editingWord} />
      </LanguageProvider>
    </MemoryRouter>,
  );
  return { onClose, onCreated };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AddPersonalWordModal — add mode', () => {
  it('debounced lookup auto-fills the meaning/IPA fields, still editable before save', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (lookupWord as ReturnType<typeof vi.fn>).mockResolvedValue({
      word: 'resilient',
      normalizedWord: 'resilient',
      ipa: 'rɪˈzɪliənt',
      audioUrl: null,
      meanings: [{ partOfSpeech: 'ADJECTIVE', definitionEn: 'able to recover quickly', definitionVi: null, exampleEn: null }],
      synonyms: [],
      viTranslation: 'kiên cường',
      viTranslationSource: 'AI',
      sourceUrl: null,
      source: 'EXTERNAL',
      vocabWordId: null,
    });
    renderModal();

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText('e.g. abandon'), 'resilient', { delay: null });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(await screen.findByDisplayValue('kiên cường')).toBeInTheDocument();
    expect(screen.getByDisplayValue('rɪˈzɪliənt')).toBeInTheDocument();

    // Still editable — overwrite the auto-filled meaning.
    const meaningInput = screen.getByDisplayValue('kiên cường');
    await act(async () => {
      await userEvent.clear(meaningInput);
      await userEvent.type(meaningInput, 'bền bỉ', { delay: null });
    });
    expect(screen.getByDisplayValue('bền bỉ')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('saving calls createPersonalVocabWord with the form fields', async () => {
    const created = existingWord();
    (lookupWord as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError('not found', 404));
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue(created);
    const { onCreated, onClose } = renderModal();

    await userEvent.type(screen.getByPlaceholderText('e.g. abandon'), 'abandon');
    await userEvent.type(screen.getByLabelText('Meaning (Vietnamese)'), 'từ bỏ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createPersonalVocabWord).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'abandon', meaningVi: 'từ bỏ' }),
      ),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalled();
  });

  it('a 409 shows the "already exists" message rather than a generic failure', async () => {
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError('conflict', 409, 'WORD_ALREADY_EXISTS'),
    );
    renderModal();

    await userEvent.type(screen.getByPlaceholderText('e.g. abandon'), 'abandon');
    await userEvent.type(screen.getByLabelText('Meaning (Vietnamese)'), 'từ bỏ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/already in your personal vocabulary list/i)).toBeInTheDocument();
  });

  it('a VOCAB_WORD_LIMIT_REACHED 403 shows an upgrade nudge instead of a generic failure', async () => {
    (createPersonalVocabWord as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError('Free accounts can save up to 50 words.', 403, 'VOCAB_WORD_LIMIT_REACHED'),
    );
    renderModal();

    await userEvent.type(screen.getByPlaceholderText('e.g. abandon'), 'newword');
    await userEvent.type(screen.getByLabelText('Meaning (Vietnamese)'), 'nghĩa');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/free accounts can save up to 50 words/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
  });
});

describe('AddPersonalWordModal — edit mode', () => {
  it('prefills every field from the word being edited and never triggers a lookup', async () => {
    renderModal({ editingWord: existingWord() });

    expect(screen.getByDisplayValue('abandon')).toBeInTheDocument();
    expect(screen.getByDisplayValue('từ bỏ')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TOEIC')).toBeInTheDocument();

    await userEvent.type(screen.getByDisplayValue('abandon'), '!');
    expect(lookupWord).not.toHaveBeenCalled();
  });

  it('saving calls updatePersonalVocabWord, not create', async () => {
    const updated = existingWord({ meaningVi: 'bỏ rơi' });
    (updatePersonalVocabWord as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
    const { onCreated } = renderModal({ editingWord: existingWord() });

    const meaningInput = screen.getByDisplayValue('từ bỏ');
    await userEvent.clear(meaningInput);
    await userEvent.type(meaningInput, 'bỏ rơi');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updatePersonalVocabWord).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ meaningVi: 'bỏ rơi' }),
      ),
    );
    expect(createPersonalVocabWord).not.toHaveBeenCalled();
    // Same object the mock resolved with — avoids a timestamp-flakiness trap
    // from reconstructing a second `existingWord()` fixture with a fresh
    // `new Date().toISOString()`.
    expect(onCreated).toHaveBeenCalledWith(updated);
  });
});
