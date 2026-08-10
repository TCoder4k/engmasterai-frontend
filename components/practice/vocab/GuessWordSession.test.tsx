import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import GuessWordSession from './GuessWordSession';
import { VocabWordListItem } from '../../../types';

vi.mock('../../../services/vocabWordService', () => ({
  getWord: vi.fn(),
}));

// Sprint — persistent, per-deck progress (VocabGuessProgress). Mocked the
// same way DictationSession's spec mocks submitReview: a real network call,
// stubbed so calls can be asserted.
vi.mock('../../../services/vocabGuessProgressService', () => ({
  getDeckGuessProgress: vi.fn(),
  markGuessWordLearned: vi.fn(),
  resetDeckGuessProgress: vi.fn(),
}));

// Partial mock: isTtsSupported keeps its real (jsdom: unsupported) behavior,
// speakText is stubbed so calls can be asserted — audio here only ever
// fires from an explicit hint-level-3 click, or a confirmed correct/skip
// outcome, never on mount/card-change.
vi.mock('../../../services/tts', async () => {
  const actual = await vi.importActual<typeof import('../../../services/tts')>('../../../services/tts');
  return { ...actual, speakText: vi.fn(() => true) };
});

import { getWord } from '../../../services/vocabWordService';
import {
  getDeckGuessProgress,
  markGuessWordLearned,
  resetDeckGuessProgress,
} from '../../../services/vocabGuessProgressService';
import { speakText } from '../../../services/tts';

const DECK_ID = 'deck-1';

beforeEach(() => {
  (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({ examples: [] });
  (markGuessWordLearned as ReturnType<typeof vi.fn>).mockResolvedValue({
    wordId: 'w1',
    learnedAt: new Date().toISOString(),
  });
  (resetDeckGuessProgress as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const word = (
  id: string,
  text: string,
  over: Partial<VocabWordListItem> = {},
): VocabWordListItem => ({
  id,
  text,
  ipa: null,
  cefrLevel: null,
  audioUrl: null,
  imageUrl: null,
  meanings: [
    { id: `vi-${id}`, partOfSpeech: 'NOUN', meaning: `nghĩa của ${text}`, orderIndex: 0 },
    { id: `en-${id}`, partOfSpeech: 'NOUN', meaning: `the English gloss of ${text}`, orderIndex: 1 },
  ],
  ...over,
});

// Every render fetches the deck's persisted progress first — `learnedWordIds`
// defaults to none-learned-yet so most tests exercise a fresh deck; pass it
// to simulate returning to a partially- or fully-learned deck. Waits for the
// component to settle on either the practice UI or the deck-complete
// summary, whichever this deck's starting state produces.
const renderSession = async (
  words: VocabWordListItem[],
  opts: { onExit?: () => void; learnedWordIds?: string[] } = {},
) => {
  const onExit = opts.onExit ?? vi.fn();
  (getDeckGuessProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
    deckId: DECK_ID,
    totalWords: words.length,
    learnedWordIds: opts.learnedWordIds ?? [],
  });
  render(
    <LanguageProvider>
      <GuessWordSession deckId={DECK_ID} words={words} onExit={onExit} />
    </LanguageProvider>,
  );
  await waitFor(() => {
    expect(
      screen.queryByPlaceholderText('Type the English word...') || screen.queryByText('Deck complete!'),
    ).toBeTruthy();
  });
  return onExit;
};

const checkAnswer = async (text: string) => {
  const input = screen.getByPlaceholderText('Type the English word...');
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await userEvent.click(screen.getByRole('button', { name: /check now/i }));
};

describe('GuessWordSession — VI -> EN prompt', () => {
  it('shows the Vietnamese meaning openly as the prompt, never masked', async () => {
    await renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledWith('w1'));

    expect(screen.getByText('nghĩa của contract')).toBeInTheDocument();
  });

  it('falls back to a "no data" prompt when the word has no meanings at all', async () => {
    await renderSession([word('w1', 'contract', { meanings: [] })]);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders the word image when imageUrl is present, and renders nothing when it is null', async () => {
    (getDeckGuessProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
      deckId: DECK_ID,
      totalWords: 1,
      learnedWordIds: [],
    });
    const { unmount } = render(
      <LanguageProvider>
        <GuessWordSession
          deckId={DECK_ID}
          words={[word('w1', 'contract', { imageUrl: 'https://example.com/contract.jpg' })]}
          onExit={vi.fn()}
        />
      </LanguageProvider>,
    );
    await screen.findByPlaceholderText('Type the English word...');
    // Decorative (alt="", aria-hidden) so it's intentionally absent from the
    // accessibility tree — query the DOM directly instead of by role.
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://example.com/contract.jpg');
    unmount();

    await renderSession([word('w2', 'agreement')]);
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('GuessWordSession — default mask shows the exact target length', () => {
  it('"contract" (8 letters) shows 8 stars by default, not the real word', async () => {
    await renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledWith('w1'));

    expect(screen.getByText('********')).toBeInTheDocument();
    expect(screen.queryByText('contract')).not.toBeInTheDocument();
  });

  it('preserves the space in a multi-word entry as a visible boundary, not a starred letter', async () => {
    await renderSession([word('w1', 'give up')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledWith('w1'));

    expect(screen.getByText('**** **')).toBeInTheDocument();
  });
});

describe('GuessWordSession — 3-level hint progression', () => {
  it('walks through levels 1, 2 and 3 with the exact deterministic masks and progress labels', async () => {
    await renderSession([word('w1', 'contract')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton);
    expect(screen.getByText('c*******')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hint 1/3' })).toBeInTheDocument();

    await userEvent.click(hintButton);
    expect(screen.getByText('c**t****')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hint 2/3' })).toBeInTheDocument();
    // Level 2 reveals exactly one letter beyond level 1 — never a whole
    // chunk of the word.
    expect(screen.queryByText('c*******')).not.toBeInTheDocument();

    await userEvent.click(hintButton);
    // Level 3 adds no more letters — the level-2 mask stays visible.
    expect(screen.getByText('c**t****')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hint 3/3' })).toBeInTheDocument();
  });

  it('a multi-word entry reveals the next hidden word\'s first letter at level 2', async () => {
    await renderSession([word('w1', 'give up')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton);
    expect(screen.getByText('g*** **')).toBeInTheDocument();

    await userEvent.click(hintButton);
    expect(screen.getByText('g*** u*')).toBeInTheDocument();
  });

  it('the hint button never disables at 3/3 — it stays clickable for the learner to request', async () => {
    await renderSession([word('w1', 'contract')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton);
    await userEvent.click(hintButton);
    await userEvent.click(hintButton);

    expect(screen.getByRole('button', { name: 'Hint 3/3' })).toBeEnabled();
  });

  it('the hint button disables once the answer has been checked', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');

    expect(screen.getByRole('button', { name: /hint/i })).toBeDisabled();
  });

  it('taking hints does not affect whether the answer counts as learned', async () => {
    await renderSession([word('w1', 'contract')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });
    await userEvent.click(hintButton);
    await userEvent.click(hintButton);
    await userEvent.click(hintButton);

    await checkAnswer('contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(markGuessWordLearned).toHaveBeenCalledWith(DECK_ID, 'w1'));
    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
  });
});

describe('GuessWordSession — check/continue flow', () => {
  it('a correct typed answer shows correct feedback, reveals the real word, and Continue marks it learned', async () => {
    await renderSession([word('w1', 'contract')]);

    await checkAnswer('contract');

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.queryByText('********')).not.toBeInTheDocument();
    expect(screen.getAllByText('contract').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(markGuessWordLearned).toHaveBeenCalledWith(DECK_ID, 'w1'));
    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
    expect(screen.getByText('Learned this session: 1/1')).toBeInTheDocument();
  });

  it('completes the deck with both words marked learned', async () => {
    // Session order is shuffled, so don't assume which of the two words
    // lands first — read it back from the DOM instead.
    await renderSession([word('w1', 'contract'), word('w2', 'agreement')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(1));
    const firstIsContract = screen.queryByText('nghĩa của contract') !== null;

    await checkAnswer(firstIsContract ? 'contract' : 'agreement');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(2));
    await checkAnswer(firstIsContract ? 'agreement' : 'contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
    expect(screen.getByText('Learned this session: 2/2')).toBeInTheDocument();
    expect(markGuessWordLearned).toHaveBeenCalledWith(DECK_ID, 'w1');
    expect(markGuessWordLearned).toHaveBeenCalledWith(DECK_ID, 'w2');
  });
});

describe('GuessWordSession — "Skip"', () => {
  it('reveals the correct word, is NOT marked learned, and requeues rather than completing a multi-word deck', async () => {
    await renderSession([word('w1', 'contract'), word('w2', 'agreement')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText(/Not quite:/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(markGuessWordLearned).not.toHaveBeenCalled();
    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Deck complete!')).not.toBeInTheDocument();
  });

  it('a single-word deck never completes from Skip alone — the same word comes right back', async () => {
    await renderSession([word('w1', 'contract')]);

    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(markGuessWordLearned).not.toHaveBeenCalled();
    expect(screen.queryByText('Deck complete!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument();
  });

  it('does nothing once already checked (no double state change)', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');

    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Correct!')).toHaveLength(1);
  });
});

describe('GuessWordSession — a wrong Check does not reveal or lock (Skip is the only reveal path)', () => {
  it('shows a plain incorrect banner without revealing the word or leaving the round', async () => {
    await renderSession([word('w1', 'contract')]);

    await checkAnswer('wrongword');

    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(screen.queryByText('contract')).not.toBeInTheDocument();
    expect(screen.queryByText(/Correct word/)).not.toBeInTheDocument();
    // Still retriable — both action buttons remain, nothing is locked.
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument();
  });

  it('retrying with the correct answer after a wrong attempt succeeds normally', async () => {
    await renderSession([word('w1', 'contract')]);

    await checkAnswer('wrongword');
    expect(screen.getByText('Incorrect')).toBeInTheDocument();

    await checkAnswer('contract');
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(markGuessWordLearned).toHaveBeenCalledWith(DECK_ID, 'w1'));
  });

  it('editing the input after a wrong attempt clears the incorrect banner', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('wrongword');
    expect(screen.getByText('Incorrect')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, 'x');

    expect(screen.queryByText('Incorrect')).not.toBeInTheDocument();
  });

  it('multiple wrong attempts in a row never lock the round or mark anything learned', async () => {
    await renderSession([word('w1', 'contract')]);

    await checkAnswer('nope');
    await checkAnswer('stillwrong');
    await checkAnswer('nopenope');

    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(markGuessWordLearned).not.toHaveBeenCalled();
  });
});

describe('GuessWordSession — Enter advances once the round is answered', () => {
  it('pressing Enter after a correct Check advances, same as clicking Continue', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, '{Enter}');

    await waitFor(() => expect(markGuessWordLearned).toHaveBeenCalledWith(DECK_ID, 'w1'));
    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
  });

  it('pressing Enter after Skip advances too, without marking the word learned', async () => {
    await renderSession([word('w1', 'contract')]);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText(/Not quite:/)).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, '{Enter}');

    await waitFor(() => expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument());
    expect(markGuessWordLearned).not.toHaveBeenCalled();
  });

  it('Enter still just checks (does not skip ahead) while the round is unanswered', async () => {
    await renderSession([word('w1', 'contract')]);
    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, 'wrongword{Enter}');

    // A wrong Enter-submit behaves exactly like a wrong Check click: no lock.
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(screen.queryByText('Correct!')).not.toBeInTheDocument();
  });
});

describe('GuessWordSession — definitions and example', () => {
  it('shows the English definition line when a gloss is present', async () => {
    await renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());

    expect(screen.getByText('the English gloss of contract')).toBeInTheDocument();
  });

  it('omits the English definition line when there is no gloss', async () => {
    await renderSession([
      word('w1', 'contract', {
        meanings: [{ id: 'vi-w1', partOfSpeech: 'NOUN', meaning: 'nghĩa của contract', orderIndex: 0 }],
      }),
    ]);

    expect(screen.queryByText(/English definition/)).not.toBeInTheDocument();
  });

  it('shows the blanked example and its translation when the fetched example literally contains the word', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({
      examples: [{ id: 'e1', sentence: 'The contract was signed yesterday.', translation: 'Hợp đồng đã được ký hôm qua.', orderIndex: 0 }],
    });
    await renderSession([word('w1', 'contract')]);

    expect(await screen.findByText('_____')).toBeInTheDocument();
    expect(screen.getByText(/was signed yesterday/)).toBeInTheDocument();
    expect(screen.getByText(/Hợp đồng đã được ký hôm qua/)).toBeInTheDocument();
    // The word itself must not leak into the visible example text.
    expect(screen.queryByText(/The contract was signed/)).not.toBeInTheDocument();
  });

  it('omits the example section entirely (never the raw sentence) when the example does not literally contain the word', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({
      // "ran" is an irregular inflection of "run" — not a literal substring.
      examples: [{ id: 'e1', sentence: 'They ran home yesterday.', translation: null, orderIndex: 0 }],
    });
    await renderSession([word('w1', 'run')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());

    expect(screen.queryByText('_____')).not.toBeInTheDocument();
    expect(screen.queryByText(/ran home/)).not.toBeInTheDocument();
  });

  it('omits the example section when the word has no examples at all', async () => {
    await renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());

    expect(screen.queryByText('_____')).not.toBeInTheDocument();
  });
});

describe('GuessWordSession — hint level 3 plays audio, never before it', () => {
  it('never autoplays on mount, and never plays before the learner explicitly reaches level 3', async () => {
    await renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());
    const hintButton = screen.getByRole('button', { name: /hint/i });

    expect(speakText).not.toHaveBeenCalled();
    await userEvent.click(hintButton); // level 1
    expect(speakText).not.toHaveBeenCalled();
    await userEvent.click(hintButton); // level 2
    expect(speakText).not.toHaveBeenCalled();
  });

  it('falls back to TTS when the word has no real audio, only once level 3 is explicitly requested', async () => {
    await renderSession([word('w1', 'contract')]); // audioUrl: null from the fixture
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton); // level 1
    await userEvent.click(hintButton); // level 2
    await userEvent.click(hintButton); // level 3
    expect(speakText).toHaveBeenCalledWith('contract');
  });

  it('repeated clicks once already at level 3 replay the pronunciation', async () => {
    await renderSession([word('w1', 'contract')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton); // 1
    await userEvent.click(hintButton); // 2
    await userEvent.click(hintButton); // 3 — first play
    await userEvent.click(hintButton); // still 3 — replay

    expect(speakText).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Hint 3/3' })).toBeInTheDocument();
  });

  it('prefers the word\'s real audioUrl over TTS when one exists', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>;
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    await renderSession([word('w1', 'contract', { audioUrl: 'https://example.com/contract.mp3' })]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton); // 1
    await userEvent.click(hintButton); // 2
    await userEvent.click(hintButton); // 3

    expect(playSpy).toHaveBeenCalled();
    expect(speakText).not.toHaveBeenCalled();
  });
});

describe('GuessWordSession — audio plays on a confirmed correct answer or on Skip', () => {
  it('plays pronunciation the moment a correct answer is confirmed', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');

    expect(speakText).toHaveBeenCalledWith('contract');
  });

  it('plays pronunciation the moment Skip is clicked', async () => {
    await renderSession([word('w1', 'contract')]);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(speakText).toHaveBeenCalledWith('contract');
  });

  it('does not play audio on a wrong, not-yet-given-up attempt', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('wrongword');

    expect(speakText).not.toHaveBeenCalled();
  });

  it('prefers the word\'s real audioUrl over TTS when confirming a correct answer', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>;
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    await renderSession([word('w1', 'contract', { audioUrl: 'https://example.com/contract.mp3' })]);
    await checkAnswer('contract');

    expect(playSpy).toHaveBeenCalled();
    expect(speakText).not.toHaveBeenCalled();
  });
});

describe('GuessWordSession — persisted progress excludes already-learned words on load', () => {
  it('does not show a word the backend reports as already learned', async () => {
    await renderSession([word('w1', 'contract'), word('w2', 'agreement')], {
      learnedWordIds: ['w1'],
    });

    await waitFor(() => expect(getWord).toHaveBeenCalledWith('w2'));
    expect(screen.getByText('nghĩa của agreement')).toBeInTheDocument();
    expect(screen.queryByText('nghĩa của contract')).not.toBeInTheDocument();
  });

  it('shows the deck-complete summary immediately when every word is already learned', async () => {
    await renderSession([word('w1', 'contract')], { learnedWordIds: ['w1'] });

    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
    expect(screen.getByText('You already know every word in this deck.')).toBeInTheDocument();
  });

  it('shows a loading state while the persisted progress is being fetched, never the practice UI early', async () => {
    let resolveProgress: (value: unknown) => void = () => {};
    (getDeckGuessProgress as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveProgress = resolve;
      }),
    );
    render(
      <LanguageProvider>
        <GuessWordSession deckId={DECK_ID} words={[word('w1', 'contract')]} onExit={vi.fn()} />
      </LanguageProvider>,
    );

    expect(screen.queryByPlaceholderText('Type the English word...')).not.toBeInTheDocument();

    resolveProgress({ deckId: DECK_ID, totalWords: 1, learnedWordIds: [] });
    await screen.findByPlaceholderText('Type the English word...');
  });

  it('shows an explicit error with a retry when the progress fetch fails — never a silent empty/full queue', async () => {
    (getDeckGuessProgress as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    render(
      <LanguageProvider>
        <GuessWordSession deckId={DECK_ID} words={[word('w1', 'contract')]} onExit={vi.fn()} />
      </LanguageProvider>,
    );

    const retryButton = await screen.findByRole('button', { name: /try again/i });
    expect(screen.queryByPlaceholderText('Type the English word...')).not.toBeInTheDocument();
    expect(screen.queryByText('Deck complete!')).not.toBeInTheDocument();

    (getDeckGuessProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
      deckId: DECK_ID,
      totalWords: 1,
      learnedWordIds: [],
    });
    await userEvent.click(retryButton);

    await screen.findByPlaceholderText('Type the English word...');
  });
});

describe('GuessWordSession — wrong/skip requeues within the session, correct removes for good', () => {
  it('a skipped word reappears later in the same session rather than being lost', async () => {
    await renderSession([word('w1', 'contract'), word('w2', 'agreement')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(2));
    const secondText = screen.queryByText('nghĩa của contract') ? 'contract' : 'agreement';
    await checkAnswer(secondText);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Only one word learned so far — the skipped one must still be pending.
    expect(markGuessWordLearned).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deck complete!')).not.toBeInTheDocument();

    // Finish the skipped word for real, on its return.
    const remainingText = secondText === 'contract' ? 'agreement' : 'contract';
    await checkAnswer(remainingText);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
    expect(markGuessWordLearned).toHaveBeenCalledTimes(2);
  });
});

describe('GuessWordSession — session-complete summary and its three actions', () => {
  it('reports an honest "already complete" message when nothing needed to be learned this session', async () => {
    await renderSession([word('w1', 'contract')], { learnedWordIds: ['w1'] });

    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
    expect(screen.getByText('You already know every word in this deck.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review words i missed/i })).not.toBeInTheDocument();
  });

  it('offers "review words I missed" only when something was actually missed, and it recycles only those words', async () => {
    await renderSession([word('w1', 'contract'), word('w2', 'agreement')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(1));
    const firstIsContract = screen.queryByText('nghĩa của contract') !== null;

    // Miss the first word via Skip, then finish both.
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(2));
    await checkAnswer(firstIsContract ? 'agreement' : 'contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await checkAnswer(firstIsContract ? 'contract' : 'agreement');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Deck complete!')).toBeInTheDocument();
    expect(screen.getByText('Needed more than one try: 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /review words i missed/i }));

    await screen.findByPlaceholderText('Type the English word...');
    expect(
      screen.getByText(firstIsContract ? 'nghĩa của contract' : 'nghĩa của agreement'),
    ).toBeInTheDocument();
  });

  it('"Học lại toàn bộ" asks for confirmation before resetting, and does nothing on cancel', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Deck complete!');

    await userEvent.click(screen.getByRole('button', { name: /learn the whole deck again/i }));
    expect(screen.getByText('Learn the whole deck again?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(resetDeckGuessProgress).not.toHaveBeenCalled();
    expect(screen.getByText('Deck complete!')).toBeInTheDocument();
  });

  it('confirming "Học lại toàn bộ" resets server progress and reloads the full deck', async () => {
    await renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Deck complete!');

    // After the reset, the progress fetch must report nothing learned again.
    (getDeckGuessProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
      deckId: DECK_ID,
      totalWords: 1,
      learnedWordIds: [],
    });

    await userEvent.click(screen.getByRole('button', { name: /learn the whole deck again/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset and start over' }));

    await waitFor(() => expect(resetDeckGuessProgress).toHaveBeenCalledWith(DECK_ID));
    await screen.findByPlaceholderText('Type the English word...');
  });

  it('"Quay lại bộ từ" calls onExit', async () => {
    const onExit = vi.fn();
    await renderSession([word('w1', 'contract')], { onExit });
    await checkAnswer('contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Deck complete!');

    await userEvent.click(screen.getByRole('button', { name: 'Back to decks' }));
    expect(onExit).toHaveBeenCalled();
  });
});
