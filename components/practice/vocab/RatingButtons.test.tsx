import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import RatingButtons from './RatingButtons';

afterEach(() => cleanup());

const renderButtons = (props: Partial<ComponentProps<typeof RatingButtons>> = {}) => {
  const onRate = vi.fn();
  render(
    <LanguageProvider>
      <RatingButtons previewIntervals={null} onRate={onRate} {...props} />
    </LanguageProvider>,
  );
  return onRate;
};

describe('RatingButtons', () => {
  it('renders all four ratings and calls onRate with the exact one clicked', async () => {
    const onRate = renderButtons();
    await userEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(onRate).toHaveBeenCalledWith('HARD');
  });

  it('shows the backend-provided day count next to each rating when previewIntervals is available', () => {
    renderButtons({ previewIntervals: { again: 1, hard: 1, good: 6, easy: 4 } });
    expect(screen.getByRole('button', { name: 'Again — 1 d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good — 6 d' })).toBeInTheDocument();
  });

  it('renders without a day count when previewIntervals has not loaded yet', () => {
    renderButtons({ previewIntervals: null });
    expect(screen.getByRole('button', { name: 'Again' })).toBeInTheDocument();
  });

  it('highlights the suggested rating without disabling the others', async () => {
    const onRate = renderButtons({ suggested: 'GOOD' });
    const good = screen.getByRole('button', { name: 'Good' });
    expect(good.className).toMatch(/ring-2/);

    await userEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(onRate).toHaveBeenCalledWith('EASY'); // overriding the suggestion is allowed
  });

  it('disables every button while a submission is in flight', () => {
    renderButtons({ disabled: true });
    for (const name of ['Again', 'Hard', 'Good', 'Easy']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
