import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ReviewDueCard from './ReviewDueCard';

// Sprint 05 — the Dashboard's shortest path to /practice/review. The counts
// are server data (from GET /learning/libraries/progress); `null` means "not
// known yet" and must never be shown as zero.
const renderCard = (
  dueTotal: number | null,
  newTotal: number | null = null,
  masteredWords: number | null = null,
  masteredPercent: number | null = null,
) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route
            path="/home"
            element={
              <ReviewDueCard
                dueTotal={dueTotal}
                newTotal={newTotal}
                masteredWords={masteredWords}
                masteredPercent={masteredPercent}
              />
            }
          />
          <Route path="/practice/review" element={<div>REVIEW_SESSION_STUB</div>} />
          <Route path="/vocab" element={<div>VOCAB_LIBRARY_STUB</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('ReviewDueCard', () => {
  it('renders nothing at all when the due total is unknown (loading or failed)', () => {
    const { container } = renderCard(null);

    expect(container).toBeEmptyDOMElement();
  });

  // The report that prompted this redesign: a brand-new account has
  // dueTotal === 0 forever (nothing has ever been rated), so the old card
  // showed a static "0 words to review" beside a review CTA — confusing for
  // someone who has never studied anything. The zero must not appear at all.
  describe('brand-new account: no due words, new words available', () => {
    it('offers to start learning instead of mentioning the due count', () => {
      renderCard(0, 20);

      expect(screen.getByText('Start learning vocabulary')).toBeInTheDocument();
      expect(screen.getByText('20 new words waiting for you')).toBeInTheDocument();
      expect(screen.queryByText(/0 words? to review/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /learn new words/i }),
      ).toHaveAttribute('href', '/practice/review');
    });

    it('uses the singular unit for exactly one new word', () => {
      renderCard(0, 1);
      expect(screen.getByText('1 new word waiting for you')).toBeInTheDocument();
    });
  });

  describe('both due and new words available', () => {
    it('names the due and new counts separately instead of summing them', () => {
      renderCard(23, 15);

      expect(screen.getByText('Learn & Review Vocabulary')).toBeInTheDocument();
      expect(screen.getByText('23 words to review')).toBeInTheDocument();
      expect(
        screen.getByText('15 new words available to learn'),
      ).toBeInTheDocument();
      // Never summed: 38 must not appear as if it were a single count.
      expect(screen.queryByText(/38/)).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /start session/i }),
      ).toHaveAttribute('href', '/practice/review');
    });

    it('uses singular units for exactly one of each', () => {
      renderCard(1, 1);
      expect(screen.getByText('1 word to review')).toBeInTheDocument();
      expect(screen.getByText('1 new word available to learn')).toBeInTheDocument();
    });
  });

  describe('due words only: the daily new-word quota is spent', () => {
    it('shows a review-only card with no mention of new words', () => {
      renderCard(18, 0);

      expect(screen.getByText('Review today')).toBeInTheDocument();
      expect(screen.getByText('18 words to review')).toBeInTheDocument();
      expect(screen.queryByText(/new word/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /review now/i }),
      ).toHaveAttribute('href', '/practice/review');
    });

    it('uses the singular unit for exactly one due word', () => {
      renderCard(1, 0);
      expect(screen.getByText('1 word to review')).toBeInTheDocument();
    });

    // Same rule as before: an unknown new-word count is treated as none
    // available, never as a reason to invent a "both" state.
    it('treats an unknown new-word count the same as zero', () => {
      renderCard(18, null);
      expect(screen.getByText('Review today')).toBeInTheDocument();
    });
  });

  describe('nothing left today: both counts are genuinely zero', () => {
    it('shows a completion state pointing at the vocabulary library, not a review CTA', () => {
      renderCard(0, 0);

      expect(screen.getByText('All done for today')).toBeInTheDocument();
      expect(
        screen.getByText(
          "You've cleared all due reviews and available new words.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /review now/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /view word sets/i }),
      ).toHaveAttribute('href', '/vocab');
    });
  });

  it('navigates to the review session when the action is clicked', async () => {
    renderCard(5, 0);

    await userEvent.click(screen.getByRole('link', { name: /review now/i }));

    expect(await screen.findByText('REVIEW_SESSION_STUB')).toBeInTheDocument();
  });

  // Compact tertiary stat folded into this card (see UserHome.tsx) — real
  // vocabulary mastery, not a fabricated number, and never a bare "0%" when
  // no mastery percent could honestly be computed.
  describe('mastered-words tertiary stat', () => {
    it('shows the mastered count and percent when both are known', () => {
      renderCard(5, 0, 126, 78);

      expect(screen.getByText('126 words mastered')).toBeInTheDocument();
      expect(screen.getByText(/78%/)).toBeInTheDocument();
    });

    it('shows the count without a percent when the percent is unknown', () => {
      renderCard(5, 0, 12, null);

      expect(screen.getByText('12 words mastered')).toBeInTheDocument();
      expect(screen.queryByText('%', { exact: false })).not.toBeInTheDocument();
    });

    it('omits the whole line when the mastered count itself is unknown', () => {
      renderCard(5, 0);

      expect(screen.queryByText(/words mastered/i)).not.toBeInTheDocument();
    });
  });
});
