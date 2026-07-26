import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ReviewDueCard from './ReviewDueCard';

// Sprint 05 — the Dashboard's shortest path to /practice/review. The count is
// server data (summed GET /learning/libraries/progress); `null` means "not
// known yet" and must never be shown as zero.
const renderCard = (dueTotal: number | null) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<ReviewDueCard dueTotal={dueTotal} />} />
          <Route path="/practice/review" element={<div>REVIEW_SESSION_STUB</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('ReviewDueCard', () => {
  it('renders the real due count and a review action when words are due', () => {
    renderCard(12);

    expect(screen.getByText('12 words waiting')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review now/i })).toHaveAttribute('href', '/practice/review');
  });

  it('uses the singular unit for exactly one due word', () => {
    renderCard(1);
    expect(screen.getByText('1 word waiting')).toBeInTheDocument();
  });

  it('shows an honest zero state instead of a call to action', () => {
    renderCard(0);

    expect(screen.getByText('Nothing due for review today.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review now/i })).not.toBeInTheDocument();
  });

  it('renders nothing at all when the total is unknown (loading or failed)', () => {
    const { container } = renderCard(null);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/waiting/i)).not.toBeInTheDocument();
    // Critically: an unknown count must not be reported as zero.
    expect(screen.queryByText('Nothing due for review today.')).not.toBeInTheDocument();
  });

  it('navigates to the review session when the action is clicked', async () => {
    renderCard(5);

    await userEvent.click(screen.getByRole('link', { name: /review now/i }));

    expect(await screen.findByText('REVIEW_SESSION_STUB')).toBeInTheDocument();
  });
});
