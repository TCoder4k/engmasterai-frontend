import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import SessionSummary from './SessionSummary';

// The "next practice mode" shortcut is opt-in — VocabPracticeSessionPage
// only passes onNext/nextModeLabel when there's a following tab in
// ModeSelectorBar's order, and omits both once the session finished on the
// last tab. This file pins that contract at the component level, isolated
// from the heavier full-page network flow.
const renderSummary = (props: Partial<React.ComponentProps<typeof SessionSummary>> = {}) =>
  render(
    <LanguageProvider>
      <SessionSummary
        result={{ totalCards: 5, correctCount: 4 }}
        onRestart={vi.fn()}
        onExit={vi.fn()}
        {...props}
      />
    </LanguageProvider>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SessionSummary — next mode shortcut', () => {
  it('renders a next-mode button labelled with the target mode when both props are given', () => {
    renderSummary({ onNext: vi.fn(), nextModeLabel: 'Guess the Word' });
    expect(screen.getByRole('button', { name: /next: guess the word/i })).toBeInTheDocument();
  });

  it('calls onNext when the next-mode button is clicked', async () => {
    const onNext = vi.fn();
    renderSummary({ onNext, nextModeLabel: 'Guess the Word' });
    await userEvent.click(screen.getByRole('button', { name: /next: guess the word/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('omits the next-mode button when nextModeLabel is missing (last tab)', () => {
    renderSummary({ onNext: vi.fn(), nextModeLabel: undefined });
    expect(screen.queryByRole('button', { name: /next:/i })).not.toBeInTheDocument();
  });

  it('omits the next-mode button when onNext is missing', () => {
    renderSummary({ onNext: undefined, nextModeLabel: 'Guess the Word' });
    expect(screen.queryByRole('button', { name: /next:/i })).not.toBeInTheDocument();
  });

  it('still renders Retry and Back to decks regardless of the next-mode props', () => {
    renderSummary();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to decks/i })).toBeInTheDocument();
  });
});
