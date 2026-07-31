import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ReviewDueCard from './ReviewDueCard';

// Sprint 05 — the Dashboard's shortest path to /practice/review. The count is
// server data (summed GET /learning/libraries/progress); `null` means "not
// known yet" and must never be shown as zero.
const renderCard = (dueTotal: number | null, newTotal: number | null = null) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route
            path="/home"
            element={<ReviewDueCard dueTotal={dueTotal} newTotal={newTotal} />}
          />
          <Route path="/practice/review" element={<div>REVIEW_SESSION_STUB</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('ReviewDueCard', () => {
  it('renders the real due count and a review action when words are due', () => {
    renderCard(12);

    expect(screen.getByText('12 words to review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review now/i })).toHaveAttribute('href', '/practice/review');
  });

  it('uses the singular unit for exactly one due word', () => {
    renderCard(1);
    expect(screen.getByText('1 word to review')).toBeInTheDocument();
  });

  it('shows an honest zero state instead of a call to action', () => {
    renderCard(0);

    expect(screen.getByText('Nothing due for review today.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review now/i })).not.toBeInTheDocument();
  });

  it('renders nothing at all when the total is unknown (loading or failed)', () => {
    const { container } = renderCard(null);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/to review/i)).not.toBeInTheDocument();
    // Critically: an unknown count must not be reported as zero.
    expect(screen.queryByText('Nothing due for review today.')).not.toBeInTheDocument();
  });

  // THE 23-vs-38 REPORT. The card said "23 từ đang chờ" and the session opened
  // with "Còn lại: 38". Both were right: the card counted words already learned
  // and now due, the session added the new words the queue introduces. The
  // difference was real and invisible.
  describe('new words in the session', () => {
    it('names the new words separately instead of folding them into the due count', () => {
      renderCard(23, 15);

      expect(screen.getByText('23 words to review')).toBeInTheDocument();
      expect(
        screen.getByText('+ 15 new words in this session'),
      ).toBeInTheDocument();
      // Never summed: 38 must not appear as if 38 words were due.
      expect(screen.queryByText(/38/)).not.toBeInTheDocument();
    });

    it('omits the new-word line when there are none', () => {
      renderCard(23, 0);

      expect(screen.queryByText(/new words in this session/i)).not.toBeInTheDocument();
    });

    // Same rule as dueTotal: unknown is not zero.
    it('omits the new-word line when the count is unknown', () => {
      renderCard(23, null);

      expect(screen.queryByText(/new words in this session/i)).not.toBeInTheDocument();
    });

    // New words alone are still a reason to open the session, so the "nothing
    // due" line must not hide them.
    it('still offers the session when only new words are available', () => {
      renderCard(0, 5);

      expect(screen.queryByText('Nothing due for review today.')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /review now/i })).toBeInTheDocument();
      expect(screen.getByText('+ 5 new words in this session')).toBeInTheDocument();
    });

    it('shows the honest empty state only when both are zero', () => {
      renderCard(0, 0);

      expect(screen.getByText('Nothing due for review today.')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /review now/i })).not.toBeInTheDocument();
    });
  });

  it('navigates to the review session when the action is clicked', async () => {
    renderCard(5);

    await userEvent.click(screen.getByRole('link', { name: /review now/i }));

    expect(await screen.findByText('REVIEW_SESSION_STUB')).toBeInTheDocument();
  });
});
