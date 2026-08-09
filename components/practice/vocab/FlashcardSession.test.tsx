import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import FlashcardSession from './FlashcardSession';
import { VocabWordListItem } from '../../../types';
import { ApiError } from '../../../services/apiError';

// getWord is a real network call (student word-detail endpoint) — mocked so
// the back-face EXAMPLE section can be tested without a live backend. Every
// test gets a default resolved (no-example) response via beforeEach; tests
// that care about the EXAMPLE section override it themselves.
vi.mock('../../../services/vocabWordService', () => ({
  getWord: vi.fn(),
}));

// Sprint 04C: getWordProgress/submitReview are real network calls too —
// mocked the same way, while isVersionConflict/isIdempotencyKeyReused (pure
// predicates over ApiError, no network) stay real via importActual.
vi.mock('../../../services/learningService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/learningService')>(
    '../../../services/learningService',
  );
  return { ...actual, getWordProgress: vi.fn(), submitReview: vi.fn() };
});

// speakText/cancelSpeech mocked so the auto-play tests below can assert on
// them directly; isTtsSupported keeps its real (jsdom: unsupported) behavior
// via importActual, same partial-mock shape as learningService above.
vi.mock('../../../services/tts', async () => {
  const actual = await vi.importActual<typeof import('../../../services/tts')>('../../../services/tts');
  return { ...actual, speakText: vi.fn(() => true), cancelSpeech: vi.fn() };
});

import { getWord } from '../../../services/vocabWordService';
import { getWordProgress, submitReview } from '../../../services/learningService';
import { speakText, cancelSpeech } from '../../../services/tts';

beforeEach(() => {
  (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({ examples: [] });
  (getWordProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
    progress: null,
    previewIntervals: { again: 1, hard: 1, good: 1, easy: 4 },
  });
  (submitReview as ReturnType<typeof vi.fn>).mockResolvedValue({
    state: 'REVIEW',
    intervalDays: 1,
    nextReviewAt: new Date().toISOString(),
    easeFactor: 2.5,
    repetitions: 1,
    lapses: 0,
    version: 1,
  });
});

// Sprint 03E regression tests for the flip fix: the original CSS used a
// descendant selector while the flipped class lives on the same element as
// the inner wrapper, so the card never flipped. These tests assert the
// class contract (compound class on the inner element) plus keyboard flip
// and the reset-to-front on advancing.
const word = (id: string, text: string, meaning: string): VocabWordListItem => ({
  id,
  text,
  ipa: null,
  cefrLevel: null,
  audioUrl: null,
  imageUrl: null,
  meanings: [{ id: `m-${id}`, partOfSpeech: 'NOUN', meaning, orderIndex: 0 }],
});

const renderSession = (words: VocabWordListItem[], onComplete = vi.fn()) => {
  render(
    <LanguageProvider>
      <FlashcardSession words={words} onComplete={onComplete} />
    </LanguageProvider>,
  );
  return onComplete;
};

const getInner = (container: HTMLElement = document.body): HTMLElement => {
  const inner = container.querySelector('.practice-flip-card-inner');
  if (!inner) throw new Error('flip-card inner not rendered');
  return inner as HTMLElement;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FlashcardSession flip', () => {
  it('clicking the card front flips it (flipped class lands on the inner element itself)', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);

    expect(getInner()).not.toHaveClass('practice-flip-card-flipped');

    await userEvent.click(screen.getByRole('button', { name: 'Tap the card to flip it' }));

    expect(getInner()).toHaveClass('practice-flip-card-flipped');
  });

  it('flips via keyboard (Enter on the focused card face)', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);

    screen.getByRole('button', { name: 'Tap the card to flip it' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(getInner()).toHaveClass('practice-flip-card-flipped');
  });

  it('flips via the Space shortcut even when nothing on the card has focus', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);
    // Nothing explicitly focused — the card's own hint chip promises Space
    // works regardless, not just when the face button happens to be focused.
    expect(document.activeElement).toBe(document.body);

    await userEvent.keyboard(' ');
    expect(getInner()).toHaveClass('practice-flip-card-flipped');

    // Toggles back too, like a real card, not just front -> back once.
    await userEvent.keyboard(' ');
    expect(getInner()).not.toHaveClass('practice-flip-card-flipped');
  });

  it('ignores the Space shortcut while a text field elsewhere has focus', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);
    const strayInput = document.createElement('input');
    document.body.appendChild(strayInput);
    strayInput.focus();

    await userEvent.keyboard(' ');

    expect(getInner()).not.toHaveClass('practice-flip-card-flipped');
    document.body.removeChild(strayInput);
  });

  it('exactly one face is exposed to assistive tech at a time', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);

    const faces = document.querySelectorAll('.practice-flip-card-face');
    expect(faces[0]).toHaveAttribute('aria-hidden', 'false');
    expect(faces[1]).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(faces[0] as HTMLElement);

    expect(faces[0]).toHaveAttribute('aria-hidden', 'true');
    expect(faces[1]).toHaveAttribute('aria-hidden', 'false');
  });

  it('advancing with a Good rating resets the next card to its front face', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng'), word('w2', 'agreement', 'thỏa thuận')]);

    await userEvent.click(screen.getByRole('button', { name: 'Tap the card to flip it' }));
    expect(getInner()).toHaveClass('practice-flip-card-flipped');

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() => expect(getInner()).not.toHaveClass('practice-flip-card-flipped'));
  });

  it('completes the session with the rated counts after the last card', async () => {
    const onComplete = renderSession([word('w1', 'contract', 'hợp đồng')]);

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 1 });
  });
});

describe('FlashcardSession — auto-play on card change', () => {
  it('speaks the very first card on mount, with no click required', () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);

    expect(speakText).toHaveBeenCalledWith('contract');
  });

  it('speaks the next card the moment a rating click advances to it', async () => {
    // Session order is shuffled (useVocabSession), so don't assume which of
    // the two words lands first — read it back from the DOM instead.
    renderSession([word('w1', 'contract', 'hợp đồng'), word('w2', 'agreement', 'thỏa thuận')]);
    const [firstText, secondText] = screen.queryAllByText('contract').length > 0
      ? ['contract', 'agreement']
      : ['agreement', 'contract'];
    expect(speakText).toHaveBeenCalledWith(firstText);

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() => expect(speakText).toHaveBeenCalledWith(secondText));
    // The outgoing card's utterance is stopped rather than left to finish
    // underneath the new one — the auto-play effect's cleanup fires before
    // the next card's effect runs.
    expect(cancelSpeech).toHaveBeenCalled();
  });

  it('plays real audio instead of TTS when the word has a recorded audioUrl', () => {
    // Deliberately not restored within the test: this component's own
    // cleanup calls .pause() on unmount, which React Testing Library's
    // cleanup() only runs in the file's afterEach — AFTER this test body
    // would have already restored the spy, defeating it. Left spied for the
    // rest of the suite is harmless (jsdom's real play/pause are themselves
    // unimplemented no-ops); vi.clearAllMocks() in afterEach still resets
    // call counts between tests.
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>;
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    renderSession([{ ...word('w1', 'contract', 'hợp đồng'), audioUrl: 'https://example.com/contract.mp3' }]);

    expect(playSpy).toHaveBeenCalled();
    expect(speakText).not.toHaveBeenCalled();
  });
});

describe('FlashcardSession — Sprint 04C real SRS ratings', () => {
  it('renders all four ratings with backend-computed preview intervals, never calculated client-side', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);

    await waitFor(() => expect(getWordProgress).toHaveBeenCalledWith('w1'));
    expect(await screen.findByRole('button', { name: 'Again — 1 d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hard — 1 d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good — 1 d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Easy — 4 d' })).toBeInTheDocument();
  });

  it('rating Again submits the real review and does NOT count as correct in the session summary', async () => {
    const onComplete = renderSession([word('w1', 'contract', 'hợp đồng')]);

    await userEvent.click(screen.getByRole('button', { name: /^Again/ }));

    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ rating: 'AGAIN', practiceMode: 'FLASHCARD' }),
      ),
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 0 }));
  });

  it('a version conflict silently refetches the preview instead of showing an error', async () => {
    (submitReview as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError('conflict', 409, 'VERSION_CONFLICT'),
    );
    renderSession([word('w1', 'contract', 'hợp đồng')]);
    await waitFor(() => expect(getWordProgress).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() => expect(getWordProgress).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('FlashcardSession real content', () => {
  it('renders the real word image on the front face when imageUrl is present', () => {
    renderSession([
      {
        id: 'w1',
        text: 'destination',
        ipa: null,
        cefrLevel: null,
        audioUrl: null,
        imageUrl: 'https://example.com/destination.jpg',
        meanings: [],
      },
    ]);

    // Decorative (alt="", aria-hidden) so it's intentionally absent from the
    // accessibility tree — query the DOM directly instead of by role.
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://example.com/destination.jpg');
  });

  it('shows the Vietnamese meaning and the English gloss as separate lines on the back', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({ examples: [] });
    renderSession([
      {
        id: 'w1',
        text: 'destination',
        ipa: "desti'neiʃn",
        cefrLevel: null,
        audioUrl: null,
        imageUrl: null,
        meanings: [
          { id: 'm1', partOfSpeech: 'NOUN', meaning: 'Nơi đến, đích đến', orderIndex: 0 },
          { id: 'm2', partOfSpeech: 'NOUN', meaning: 'a place someone is going to', orderIndex: 1 },
        ],
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Tap the card to flip it' }));

    expect(screen.getByText('Nơi đến, đích đến')).toBeInTheDocument();
    expect(screen.getByText('a place someone is going to')).toBeInTheDocument();
  });

  it('shows the real example sentence with the target word highlighted plus its translation', async () => {
    (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({
      examples: [
        { id: 'e1', sentence: 'The next destination is Ha Long bay.', translation: 'Điểm đến tiếp theo là vịnh Hạ Long.', orderIndex: 0 },
      ],
    });
    renderSession([
      {
        id: 'w1',
        text: 'destination',
        ipa: null,
        cefrLevel: null,
        audioUrl: null,
        imageUrl: null,
        meanings: [{ id: 'm1', partOfSpeech: 'NOUN', meaning: 'Nơi đến', orderIndex: 0 }],
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Tap the card to flip it' }));

    expect(await screen.findByText(/The next/)).toBeInTheDocument();
    // The target word is wrapped in its own highlighted span within the
    // example — assert against that specific element, not any "destination"
    // text on the page (the word itself is also shown above the meaning).
    expect(document.querySelector('.underline')).toHaveTextContent('destination');
    expect(screen.getByText(/Điểm đến tiếp theo là vịnh Hạ Long/)).toBeInTheDocument();
  });
});
