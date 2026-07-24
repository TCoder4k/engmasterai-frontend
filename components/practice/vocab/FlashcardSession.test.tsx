import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import FlashcardSession from './FlashcardSession';
import { VocabWordListItem } from '../../../types';

// getWord is a real network call (student word-detail endpoint) — mocked so
// the back-face EXAMPLE section can be tested without a live backend. Every
// test gets a default resolved (no-example) response via beforeEach; tests
// that care about the EXAMPLE section override it themselves.
vi.mock('../../../services/vocabWordService', () => ({
  getWord: vi.fn(),
}));

import { getWord } from '../../../services/vocabWordService';

beforeEach(() => {
  (getWord as ReturnType<typeof vi.fn>).mockResolvedValue({ examples: [] });
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

  it('exactly one face is exposed to assistive tech at a time', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng')]);

    const faces = document.querySelectorAll('.practice-flip-card-face');
    expect(faces[0]).toHaveAttribute('aria-hidden', 'false');
    expect(faces[1]).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(faces[0] as HTMLElement);

    expect(faces[0]).toHaveAttribute('aria-hidden', 'true');
    expect(faces[1]).toHaveAttribute('aria-hidden', 'false');
  });

  it('advancing with Again/Got it resets the next card to its front face', async () => {
    renderSession([word('w1', 'contract', 'hợp đồng'), word('w2', 'agreement', 'thỏa thuận')]);

    await userEvent.click(screen.getByRole('button', { name: 'Tap the card to flip it' }));
    expect(getInner()).toHaveClass('practice-flip-card-flipped');

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(getInner()).not.toHaveClass('practice-flip-card-flipped');
  });

  it('completes the session with the rated counts after the last card', async () => {
    const onComplete = renderSession([word('w1', 'contract', 'hợp đồng')]);

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 1, correctCount: 1 });
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
