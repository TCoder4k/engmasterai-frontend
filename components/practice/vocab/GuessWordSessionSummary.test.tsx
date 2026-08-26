import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import GuessWordSessionSummary from './GuessWordSessionSummary';

// Guess-the-Word owns its own completion screen (see GuessWordSession.tsx's
// header comment — it never touches SessionSummary/onComplete), so the
// next-mode shortcut needs its own, separate wiring here. Same opt-in
// contract as SessionSummary.test.tsx: VocabPracticeSessionPage passes
// undefined for both props once there's no following tab.
const renderSummary = (props: Partial<React.ComponentProps<typeof GuessWordSessionSummary>> = {}) =>
  render(
    <LanguageProvider>
      <GuessWordSessionSummary
        totalWords={10}
        learnedThisSessionCount={3}
        struggledCount={0}
        onReviewStruggled={vi.fn()}
        onRestartFull={vi.fn()}
        onExit={vi.fn()}
        {...props}
      />
    </LanguageProvider>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('GuessWordSessionSummary — next mode shortcut', () => {
  it('renders a next-mode button labelled with the target mode when both props are given', () => {
    renderSummary({ onNext: vi.fn(), nextModeLabel: 'Games' });
    expect(screen.getByRole('button', { name: /next: games/i })).toBeInTheDocument();
  });

  it('calls onNext when the next-mode button is clicked', async () => {
    const onNext = vi.fn();
    renderSummary({ onNext, nextModeLabel: 'Games' });
    await userEvent.click(screen.getByRole('button', { name: /next: games/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('omits the next-mode button when neither prop is given (last tab)', () => {
    renderSummary();
    expect(screen.queryByRole('button', { name: /next:/i })).not.toBeInTheDocument();
  });
});
