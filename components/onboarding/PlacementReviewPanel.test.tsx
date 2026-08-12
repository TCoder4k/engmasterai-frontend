import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import PlacementReviewPanel from './PlacementReviewPanel';
import { PlacementReview, PlacementReviewItem } from '../../services/placementService';

vi.mock('../../services/placementService', async () => {
  const actual =
    await vi.importActual<typeof import('../../services/placementService')>(
      '../../services/placementService',
    );
  return {
    ...actual,
    getPlacementAttemptReview: vi.fn(),
  };
});

import { getPlacementAttemptReview } from '../../services/placementService';
const mockGetReview = vi.mocked(getPlacementAttemptReview);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const item = (overrides: Partial<PlacementReviewItem> = {}): PlacementReviewItem => ({
  questionId: 'g1',
  section: 'GRAMMAR',
  type: 'MULTIPLE_CHOICE',
  content: 'She ___ to work.',
  options: [
    { id: 'a', text: 'go' },
    { id: 'b', text: 'goes' },
  ],
  audioUrl: null,
  transcript: null,
  imageUrl: null,
  submitted: { optionId: 'b' },
  isCorrect: true,
  correctAnswer: { optionId: 'b' },
  explanation: null,
  ...overrides,
});

const review = (items: PlacementReviewItem[]): PlacementReview => ({
  attemptId: 'attempt-1',
  items,
});

const renderPanel = (onBack = vi.fn()) =>
  render(
    <LanguageProvider>
      <PlacementReviewPanel attemptId="attempt-1" onBack={onBack} />
    </LanguageProvider>,
  );

describe('PlacementReviewPanel', () => {
  it('fetches the review for the given attempt on mount', () => {
    mockGetReview.mockResolvedValueOnce(review([]));
    renderPanel();
    expect(mockGetReview).toHaveBeenCalledWith('attempt-1');
  });

  it('groups questions by section with a correct-count summary per section', async () => {
    mockGetReview.mockResolvedValueOnce(
      review([
        item({ questionId: 'g1', section: 'GRAMMAR', isCorrect: true }),
        item({ questionId: 'g2', section: 'GRAMMAR', isCorrect: false, content: 'He ___ tired.' }),
        item({ questionId: 'l1', section: 'LISTENING', content: 'Where is the bus stop?' }),
      ]),
    );
    renderPanel();

    expect(await screen.findByText('She ___ to work.')).toBeInTheDocument();
    expect(screen.getByText('He ___ tired.')).toBeInTheDocument();
    expect(screen.getByText('Where is the bus stop?')).toBeInTheDocument();
    expect(screen.getByText('Grammar')).toBeInTheDocument();
    expect(screen.getByText('Listening')).toBeInTheDocument();
    // 1 correct out of 2 Grammar questions.
    expect(screen.getByText('1 / 2 correct')).toBeInTheDocument();
    // Vocabulary has no items for this attempt fixture — its section header
    // must not render at all.
    expect(screen.queryByText('Vocabulary')).not.toBeInTheDocument();
  });

  it('flags an unanswered question distinctly from a wrong answer', async () => {
    mockGetReview.mockResolvedValueOnce(
      review([item({ submitted: null, isCorrect: false })]),
    );
    renderPanel();

    expect(await screen.findByText('Not answered')).toBeInTheDocument();
  });

  it('never shows an unanswered badge for a genuinely-answered question', async () => {
    mockGetReview.mockResolvedValueOnce(review([item({ submitted: { optionId: 'b' } })]));
    renderPanel();

    expect(await screen.findByText('She ___ to work.')).toBeInTheDocument();
    expect(screen.queryByText('Not answered')).not.toBeInTheDocument();
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetReview.mockRejectedValueOnce(new Error('network down'));
    mockGetReview.mockResolvedValueOnce(review([item()]));
    const user = userEvent.setup();
    renderPanel();

    expect(
      await screen.findByText('Could not load your test details. Please try again.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('She ___ to work.')).toBeInTheDocument();
    expect(mockGetReview).toHaveBeenCalledTimes(2);
  });

  it('calls onBack when the Back button is clicked', async () => {
    mockGetReview.mockResolvedValueOnce(review([]));
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderPanel(onBack);

    await user.click(screen.getByRole('button', { name: /back to results/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
