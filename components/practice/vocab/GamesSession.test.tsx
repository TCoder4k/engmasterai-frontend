import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import GamesSession from './GamesSession';
import { VocabWordListItem } from '../../../types';

// Sound calls are asserted (and neutralized) via a module mock — the real
// service is fail-safe in jsdom anyway, but the mock lets the timeout test
// verify the timeout sound fires.
vi.mock('../../../services/feedbackSounds', () => ({
  playCorrect: vi.fn(),
  playIncorrect: vi.fn(),
  playTimeout: vi.fn(),
  playComplete: vi.fn(),
  isMuted: () => false,
  setMuted: vi.fn(),
}));

import { playTimeout, playComplete } from '../../../services/feedbackSounds';

const word = (id: string, text: string, meaning: string): VocabWordListItem => ({
  id,
  text,
  ipa: null,
  cefrLevel: null,
  audioUrl: null,
  imageUrl: null,
  meanings: [{ id: `m-${id}`, partOfSpeech: 'NOUN', meaning, orderIndex: 0 }],
});

const WORDS = [word('w1', 'alpha', 'first letter'), word('w2', 'beta', 'second letter')];

const renderGames = (onComplete = vi.fn()) => {
  render(
    <LanguageProvider>
      <GamesSession words={WORDS} onComplete={onComplete} />
    </LanguageProvider>,
  );
  return onComplete;
};

// The countdown is a CHAIN of 1s setTimeouts (each scheduled from the
// effect that runs after the previous tick's state update), so fake-timer
// advances must happen in 1s steps — one big advance would only ever fire
// the first tick.
const advanceSeconds = (n: number) => {
  for (let i = 0; i < n; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
};

describe('Speed round timeout behavior (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('on timeout: locks, reveals, plays the timeout sound, and advances exactly once after the reveal window', () => {
    renderGames();

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();

    // Run the full 8s countdown.
    advanceSeconds(8);

    // Locked + revealed + timeout announced; options disabled.
    expect(screen.getByText("Time's up!")).toBeInTheDocument();
    expect(playTimeout).toHaveBeenCalledTimes(1);
    for (const option of screen.getAllByRole('button', { name: /letter/ })) {
      expect(option).toBeDisabled();
    }

    // Still on the same question during the reveal window…
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Question 1/2')).toBeInTheDocument();

    // …and exactly one advance after it (1500ms total).
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
  });

  it('a full-timeout Speed Round shows the go-to-Matching-Game interstitial without calling onComplete', () => {
    const onComplete = renderGames();

    // Two questions, each: 8s countdown then a 1.5s reveal window.
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Finishing Speed Round does not exit the mode — it offers Matching
    // Game next, not "back to deck list".
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText('Speed Round complete!')).toBeInTheDocument();
    expect(screen.getByText('Score: 0/2 (0%)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Matching Game' })).toBeInTheDocument();
  });

  it('clicking "Go to Matching Game" from the Speed Round interstitial switches games', () => {
    renderGames();
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Go to Matching Game' }));

    expect(screen.getByRole('button', { name: 'alpha' })).toBeInTheDocument();
  });

  it('"Try again" from the Speed Round interstitial restarts a fresh round', () => {
    renderGames();
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
  });

  it('re-entering the Speed Round tab after finishing it starts a fresh round, not the stale interstitial', () => {
    renderGames();
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    advanceSeconds(8);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText('Speed Round complete!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^matching game$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^speed round$/i }));

    expect(screen.getByText('Question 1/2')).toBeInTheDocument();
    expect(screen.queryByText('Speed Round complete!')).not.toBeInTheDocument();
  });

  it('answering before timeout locks the question and advances after a short delay (no double advance)', () => {
    renderGames();

    const question = screen.getByText(/alpha|beta/, { selector: 'p' }).textContent;
    const correctMeaning = question === 'alpha' ? 'first letter' : 'second letter';

    fireEvent.click(screen.getByRole('button', { name: correctMeaning }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Question 2/2')).toBeInTheDocument();

    // The old countdown must not fire a second advance later.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Question 2/2')).toBeInTheDocument();
  });

  it('clears pending timers on unmount without spurious effects', () => {
    const onComplete = vi.fn();
    const { unmount } = render(
      <LanguageProvider>
        <GamesSession words={WORDS} onComplete={onComplete} />
      </LanguageProvider>,
    );

    advanceSeconds(8);
    unmount();
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('Matching game pair removal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const openMatchTab = () => {
    fireEvent.click(screen.getByRole('button', { name: /matching game/i }));
  };

  it('a correct pair briefly highlights, then both cards are removed and cannot be re-selected', () => {
    renderGames();
    openMatchTab();

    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'first letter' }));

    // Still visible during the brief correct-flash…
    expect(screen.getByRole('button', { name: 'alpha' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // …then removed entirely (not just disabled).
    expect(screen.queryByRole('button', { name: 'alpha' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'first letter' })).not.toBeInTheDocument();
    // The unmatched pair remains.
    expect(screen.getByRole('button', { name: 'beta' })).toBeInTheDocument();
  });

  it('an incorrect pair stays on the board after the wrong-flash', () => {
    renderGames();
    openMatchTab();

    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'second letter' }));

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByRole('button', { name: 'alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'second letter' })).toBeInTheDocument();
  });

  it('completion fires only after every pair has been removed', () => {
    const onComplete = renderGames();
    openMatchTab();

    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'first letter' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'beta' }));
    fireEvent.click(screen.getByRole('button', { name: 'second letter' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(playComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ totalCards: 2, correctCount: 2 });
  });
});
