import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import LearningTrackCard from './LearningTrackCard';
import { CourseType } from '../../types';

// The design reference prints a size under every track ("25 Lessons",
// "30 Sub-Decks", "20 Segments"). Those are now real figures passed down by
// UserHome, so the one thing worth pinning is what happens when the number
// is NOT known: nothing is printed. A 0 there would read as "this module is
// empty" on every slow connection.
const renderTrack = (type: CourseType, count: number | null) =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <LearningTrackCard type={type} count={count} />
      </MemoryRouter>
    </LanguageProvider>,
  );

afterEach(cleanup);

describe('LearningTrackCard', () => {
  it('prints the real count it is given', () => {
    renderTrack('GRAMMAR', 25);
    expect(screen.getByText('25 Lessons')).toBeInTheDocument();
  });

  it('prints nothing at all while the count is unknown', () => {
    const { container } = renderTrack('VOCABULARY', null);

    expect(container.textContent).not.toMatch(/\d/);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/vocab');
  });

  it('sends each track to its own module', () => {
    renderTrack('LISTENING', 20);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/practice/listening');
    expect(screen.getByText('20 Segments')).toBeInTheDocument();
  });
});
