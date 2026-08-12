import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import PlacementProgressBar from './PlacementProgressBar';

afterEach(cleanup);

const renderBar = (current: number, total: number) =>
  render(
    <LanguageProvider>
      <PlacementProgressBar current={current} total={total} />
    </LanguageProvider>,
  );

describe('PlacementProgressBar', () => {
  it('renders a "current/total" label, 1-indexed', () => {
    renderBar(0, 12);
    expect(screen.getByText('1/12 questions')).toBeInTheDocument();
  });

  it('advances the label as the position moves', () => {
    renderBar(8, 12);
    expect(screen.getByText('9/12 questions')).toBeInTheDocument();
  });

  it('reaches the final label on the last question', () => {
    renderBar(11, 12);
    expect(screen.getByText('12/12 questions')).toBeInTheDocument();
  });
});
