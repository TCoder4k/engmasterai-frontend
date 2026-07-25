import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import ReviewSessionSummary from './ReviewSessionSummary';

afterEach(() => cleanup());

const renderSummary = (props: Partial<ComponentProps<typeof ReviewSessionSummary>> = {}) => {
  const onRestart = vi.fn();
  render(
    <MemoryRouter>
      <LanguageProvider>
        <ReviewSessionSummary
          reviewedCount={3}
          retrainedCount={0}
          ratingCounts={{ AGAIN: 1, HARD: 0, GOOD: 2, EASY: 0 }}
          newlyLearnedCount={0}
          masteredCount={0}
          elapsedMs={65_000}
          backHref="/vocab"
          onRestart={onRestart}
          {...props}
        />
      </LanguageProvider>
    </MemoryRouter>,
  );
  return onRestart;
};

describe('ReviewSessionSummary', () => {
  it('computes accuracy from real reviewed/again counts — never a fake percentage', () => {
    renderSummary({ reviewedCount: 3, ratingCounts: { AGAIN: 1, HARD: 0, GOOD: 2, EASY: 0 } });
    // 2 of 3 correct -> 67%, not a hardcoded number.
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('shows 0% accuracy honestly when nothing was reviewed, never NaN or a crash', () => {
    renderSummary({ reviewedCount: 0, ratingCounts: { AGAIN: 0, HARD: 0, GOOD: 0, EASY: 0 } });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('breaks the session down by each real rating, not just a single accuracy number', () => {
    renderSummary({ reviewedCount: 10, ratingCounts: { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 } });

    expect(screen.getByText('Your ratings')).toBeInTheDocument();
    // Each rating label sits next to its own real count.
    for (const label of ['Again', 'Hard', 'Good', 'Easy']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('formats the real elapsed session time', () => {
    renderSummary({ elapsedMs: 125_000 });
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('reports retrain passes separately so they are not counted as reviews', () => {
    renderSummary({ reviewedCount: 3, retrainedCount: 2 });
    expect(screen.getByText('Practised again: 2')).toBeInTheDocument();
  });

  it('hides the achievement row entirely when nothing actually happened', () => {
    // A row of zeroes would read as a fabricated scoreboard.
    renderSummary({ newlyLearnedCount: 0, masteredCount: 0, retrainedCount: 0 });
    expect(screen.queryByText(/Newly started/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Newly mastered/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Practised again/)).not.toBeInTheDocument();
  });

  it('shows newly-learned and newly-mastered only when a real transition occurred', () => {
    renderSummary({ newlyLearnedCount: 2, masteredCount: 1 });
    expect(screen.getByText('Newly started: 2')).toBeInTheDocument();
    expect(screen.getByText('Newly mastered: 1')).toBeInTheDocument();
  });

  it('never shows XP or streak — no fake gamification data', () => {
    renderSummary();
    expect(screen.queryByText(/\bXP\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('the restart button calls onRestart, and the back link points at the given href', async () => {
    const onRestart = renderSummary({ backHref: '/vocab/libraries/lib-1' });
    await userEvent.click(screen.getByRole('button', { name: 'Review more' }));
    expect(onRestart).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('link', { name: 'Back to decks' })).toHaveAttribute(
      'href',
      '/vocab/libraries/lib-1',
    );
  });
});
