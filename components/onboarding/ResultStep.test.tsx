import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ResultStep from './ResultStep';
import { PlacementResult } from '../../services/placementService';

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

const result = (overrides: Partial<PlacementResult> = {}): PlacementResult => ({
  attemptId: 'attempt-1',
  grammarScore: 100,
  vocabularyScore: 75,
  listeningScore: 0,
  overallScore: 58,
  estimatedLevel: 'A1',
  durationSeconds: 240,
  completedAt: new Date().toISOString(),
  ...overrides,
});

const renderResult = (r: PlacementResult, onContinue = vi.fn()) =>
  render(
    <LanguageProvider>
      <ResultStep result={r} onContinue={onContinue} />
    </LanguageProvider>,
  );

describe('ResultStep', () => {
  it("renders the level and its friendly name, derived from the server's estimatedLevel only", () => {
    renderResult(result({ estimatedLevel: 'A1' }));
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(
      screen.getByText(/every English journey begins with small steps/i),
    ).toBeInTheDocument();
  });

  it('derives X/Y correct counts from the section score without any new backend field', () => {
    // sectionScore = correctInSection / 4 * 100, so 100% -> 4/4, 75% -> 3/4, 0% -> 0/4.
    renderResult(result({ grammarScore: 100, vocabularyScore: 75, listeningScore: 0 }));
    expect(screen.getByText('4 / 4 correct')).toBeInTheDocument();
    expect(screen.getByText('3 / 4 correct')).toBeInTheDocument();
    expect(screen.getByText('0 / 4 correct')).toBeInTheDocument();
  });

  it('shows the overall score inside the gauge', () => {
    renderResult(result({ overallScore: 58 }));
    expect(screen.getByText('58%')).toBeInTheDocument();
  });

  it('clicking "view test details" opens the review panel and fetches the graded breakdown for this attempt', async () => {
    mockGetReview.mockResolvedValueOnce({
      attemptId: 'attempt-1',
      items: [
        {
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
        },
      ],
    });
    const user = userEvent.setup();
    renderResult(result());

    await user.click(screen.getByRole('button', { name: /view test details/i }));

    expect(mockGetReview).toHaveBeenCalledWith('attempt-1');
    expect(await screen.findByText('She ___ to work.')).toBeInTheDocument();
  });

  it("the review panel's Back button returns to the result summary", async () => {
    mockGetReview.mockResolvedValueOnce({ attemptId: 'attempt-1', items: [] });
    const user = userEvent.setup();
    renderResult(result({ overallScore: 58 }));

    await user.click(screen.getByRole('button', { name: /view test details/i }));
    await screen.findByText('Test details');
    await user.click(screen.getByRole('button', { name: /back to results/i }));

    expect(screen.getByText('58%')).toBeInTheDocument();
  });

  it('the primary button calls onContinue and is enabled', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    renderResult(result(), onContinue);

    await user.click(screen.getByRole('button', { name: /view roadmap analysis/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('renders a different friendly level name and encouragement for a higher level', () => {
    renderResult(result({ estimatedLevel: 'C1' }));
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });
});
