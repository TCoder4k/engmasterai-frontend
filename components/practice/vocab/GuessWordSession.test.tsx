import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import GuessWordSession from './GuessWordSession';
import { VocabWordListItem } from '../../../types';

vi.mock('../../../services/vocabWordService', () => ({
  getWord: vi.fn(),
}));

// Partial mock: isTtsSupported keeps its real (jsdom: unsupported) behavior,
// speakText is stubbed so calls can be asserted — audio here only ever
// fires from an explicit hint-level-3 click, never on mount/card-change.
vi.mock('../../../services/tts', async () => {
  const actual = await vi.importActual<typeof import('../../../services/tts')>('../../../services/tts');
  return { ...actual, speakText: vi.fn(() => true) };
});

import { getWord } from '../../../services/vocabWordService';
import { speakText } from '../../../services/tts';

beforeEach(() => {
  (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({ examples: [] });
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

const renderSession = (words: VocabWordListItem[], onComplete = vi.fn()) => {
  render(
    <LanguageProvider>
      <GuessWordSession words={words} onComplete={onComplete} />
    </LanguageProvider>,
  );
  return onComplete;
};

const checkAnswer = async (text: string) => {
  const input = screen.getByPlaceholderText('Type the English word...');
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await userEvent.click(screen.getByRole('button', { name: /check now/i }));
};

describe('GuessWordSession — VI -> EN prompt', () => {
  it('shows the Vietnamese meaning openly as the prompt, never masked', async () => {
    renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledWith('w1'));

    expect(screen.getByText('nghĩa của contract')).toBeInTheDocument();
  });

  it('falls back to a "no data" prompt when the word has no meanings at all', async () => {
    renderSession([word('w1', 'contract', { meanings: [] })]);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders the word image when imageUrl is present, and renders nothing when it is null', async () => {
    const { unmount } = render(
      <LanguageProvider>
        <GuessWordSession
          words={[word('w1', 'contract', { imageUrl: 'https://example.com/contract.jpg' })]}
          onComplete={vi.fn()}
        />
      </LanguageProvider>,
    );
    // Decorative (alt="", aria-hidden) so it's intentionally absent from the
    // accessibility tree — query the DOM directly instead of by role.
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://example.com/contract.jpg');
    unmount();

    renderSession([word('w2', 'agreement')]);
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('GuessWordSession — default mask shows the exact target length', () => {
  it('"contract" (8 letters) shows 8 stars by default, not the real word', async () => {
    renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledWith('w1'));

    expect(screen.getByText('********')).toBeInTheDocument();
    expect(screen.queryByText('contract')).not.toBeInTheDocument();
  });

  it('preserves the space in a multi-word entry as a visible boundary, not a starred letter', async () => {
    renderSession([word('w1', 'give up')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledWith('w1'));

    expect(screen.getByText('**** **')).toBeInTheDocument();
  });
});

describe('GuessWordSession — 3-level hint progression', () => {
  it('walks through levels 1, 2 and 3 with the exact deterministic masks and progress labels', async () => {
    renderSession([word('w1', 'contract')]);
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
    renderSession([word('w1', 'give up')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton);
    expect(screen.getByText('g*** **')).toBeInTheDocument();

    await userEvent.click(hintButton);
    expect(screen.getByText('g*** u*')).toBeInTheDocument();
  });

  it('the hint button never disables at 3/3 — it stays clickable for the learner to request', async () => {
    renderSession([word('w1', 'contract')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton);
    await userEvent.click(hintButton);
    await userEvent.click(hintButton);

    expect(screen.getByRole('button', { name: 'Hint 3/3' })).toBeEnabled();
  });

  it('the hint button disables once the answer has been checked', async () => {
    renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');

    expect(screen.getByRole('button', { name: /hint/i })).toBeDisabled();
  });

  it('taking hints does not affect whether the answer counts as correct', async () => {
    const onComplete = renderSession([word('w1', 'contract')]);
    const hintButton = screen.getByRole('button', { name: /hint/i });
    await userEvent.click(hintButton);
    await userEvent.click(hintButton);
    await userEvent.click(hintButton);

    await checkAnswer('contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 1 }));
  });
});

describe('GuessWordSession — check/continue flow', () => {
  it('a correct typed answer shows correct feedback, reveals the real word, and Continue advances', async () => {
    const onComplete = renderSession([word('w1', 'contract')]);

    await checkAnswer('contract');

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.queryByText('********')).not.toBeInTheDocument();
    expect(screen.getAllByText('contract').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 1 }));
  });

  it('completes the session with correct totals across multiple cards', async () => {
    // Session order is shuffled (useVocabSession), so don't assume which of
    // the two words lands first — read it back from the DOM instead.
    const onComplete = renderSession([word('w1', 'contract'), word('w2', 'agreement')]);
    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(1));
    const firstIsContract = screen.queryByText('nghĩa của contract') !== null;

    await checkAnswer(firstIsContract ? 'contract' : 'agreement');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(getWord).toHaveBeenCalledTimes(2));
    await checkAnswer(firstIsContract ? 'agreement' : 'contract');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 2, correctCount: 2 }));
  });
});

describe('GuessWordSession — "Skip"', () => {
  it('reveals the correct word, counts as incorrect, and Continue advances', async () => {
    const onComplete = renderSession([word('w1', 'contract')]);

    await userEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(screen.getByText('Not quite: contract')).toBeInTheDocument();
    expect(screen.getAllByText('contract').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 0 }));
  });

  it('does nothing once already checked (no double state change)', async () => {
    renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');

    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Correct!')).toHaveLength(1);
  });
});

describe('GuessWordSession — a wrong Check does not reveal or lock (Skip is the only reveal path)', () => {
  it('shows a plain incorrect banner without revealing the word or leaving the round', async () => {
    renderSession([word('w1', 'contract')]);

    await checkAnswer('wrongword');

    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(screen.queryByText('contract')).not.toBeInTheDocument();
    expect(screen.queryByText(/Correct word/)).not.toBeInTheDocument();
    // Still retriable — both action buttons remain, nothing is locked.
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument();
  });

  it('retrying with the correct answer after a wrong attempt succeeds normally', async () => {
    const onComplete = renderSession([word('w1', 'contract')]);

    await checkAnswer('wrongword');
    expect(screen.getByText('Incorrect')).toBeInTheDocument();

    await checkAnswer('contract');
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 1 }));
  });

  it('editing the input after a wrong attempt clears the incorrect banner', async () => {
    renderSession([word('w1', 'contract')]);
    await checkAnswer('wrongword');
    expect(screen.getByText('Incorrect')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, 'x');

    expect(screen.queryByText('Incorrect')).not.toBeInTheDocument();
  });

  it('multiple wrong attempts in a row never lock the round or count toward completion', async () => {
    const onComplete = renderSession([word('w1', 'contract')]);

    await checkAnswer('nope');
    await checkAnswer('stillwrong');
    await checkAnswer('nopenope');

    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('GuessWordSession — Enter advances once the round is answered', () => {
  it('pressing Enter after a correct Check advances, same as clicking Continue', async () => {
    const onComplete = renderSession([word('w1', 'contract')]);
    await checkAnswer('contract');
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, '{Enter}');

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 1 }));
  });

  it('pressing Enter after Skip advances too', async () => {
    const onComplete = renderSession([word('w1', 'contract')]);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText('Not quite: contract')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, '{Enter}');

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 0 }));
  });

  it('Enter still just checks (does not skip ahead) while the round is unanswered', async () => {
    renderSession([word('w1', 'contract')]);
    const input = screen.getByPlaceholderText('Type the English word...');
    await userEvent.type(input, 'wrongword{Enter}');

    // A wrong Enter-submit behaves exactly like a wrong Check click: no lock.
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(screen.queryByText('Correct!')).not.toBeInTheDocument();
  });
});

describe('GuessWordSession — definitions and example', () => {
  it('shows the English definition line when a gloss is present', async () => {
    renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());

    expect(screen.getByText('the English gloss of contract')).toBeInTheDocument();
  });

  it('omits the English definition line when there is no gloss', async () => {
    renderSession([
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
    renderSession([word('w1', 'contract')]);

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
    renderSession([word('w1', 'run')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());

    expect(screen.queryByText('_____')).not.toBeInTheDocument();
    expect(screen.queryByText(/ran home/)).not.toBeInTheDocument();
  });

  it('omits the example section when the word has no examples at all', async () => {
    renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());

    expect(screen.queryByText('_____')).not.toBeInTheDocument();
  });
});

describe('GuessWordSession — hint level 3 plays audio, never before it', () => {
  it('never autoplays on mount, and never plays before the learner explicitly reaches level 3', async () => {
    renderSession([word('w1', 'contract')]);
    await waitFor(() => expect(getWord).toHaveBeenCalled());
    const hintButton = screen.getByRole('button', { name: /hint/i });

    expect(speakText).not.toHaveBeenCalled();
    await userEvent.click(hintButton); // level 1
    expect(speakText).not.toHaveBeenCalled();
    await userEvent.click(hintButton); // level 2
    expect(speakText).not.toHaveBeenCalled();
  });

  it('falls back to TTS when the word has no real audio, only once level 3 is explicitly requested', async () => {
    renderSession([word('w1', 'contract')]); // audioUrl: null from the fixture
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton); // level 1
    await userEvent.click(hintButton); // level 2
    await userEvent.click(hintButton); // level 3
    expect(speakText).toHaveBeenCalledWith('contract');
  });

  it('repeated clicks once already at level 3 replay the pronunciation', async () => {
    renderSession([word('w1', 'contract')]);
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

    renderSession([word('w1', 'contract', { audioUrl: 'https://example.com/contract.mp3' })]);
    const hintButton = screen.getByRole('button', { name: /hint/i });

    await userEvent.click(hintButton); // 1
    await userEvent.click(hintButton); // 2
    await userEvent.click(hintButton); // 3

    expect(playSpy).toHaveBeenCalled();
    expect(speakText).not.toHaveBeenCalled();
  });
});
