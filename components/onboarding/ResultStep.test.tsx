import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
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
    requestPlacementRoadmapPlan: vi.fn(),
  };
});

import {
  getPlacementAttemptReview,
  requestPlacementRoadmapPlan,
} from '../../services/placementService';
const mockGetReview = vi.mocked(getPlacementAttemptReview);
const mockRequestPlan = vi.mocked(requestPlacementRoadmapPlan);

beforeEach(() => {
  mockRequestPlan.mockResolvedValue({
    goal: 'FOUNDATION',
    estimatedLevel: 'A1',
    levelSource: 'BEGINNER_ASSUMED',
    placementAttemptId: null,
    generatedAt: new Date().toISOString(),
    aiSummary: null,
    aiPlanningUsed: false,
    items: [],
  });
});

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

  // Auto-fired on mount, no click required — the student never needs to
  // know AI was involved.
  it('fires AI roadmap planning automatically on mount, without any click', async () => {
    renderResult(result());
    await waitFor(() => expect(mockRequestPlan).toHaveBeenCalledTimes(1));
  });

  // Navigation is HELD until planning resolves — never fire-and-forget — so
  // RoadmapStep can't render a pre-AI-planning roadmap that then silently
  // changes a moment later.
  it('shows a loading state and disables both buttons while the AI plan is in flight, then enables once ready', async () => {
    let resolvePlan!: (value: Awaited<ReturnType<typeof requestPlacementRoadmapPlan>>) => void;
    mockRequestPlan.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePlan = resolve;
      }),
    );
    const onContinue = vi.fn();
    renderResult(result(), onContinue);

    expect(await screen.findByText(/preparing your roadmap/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view test details/i })).toBeDisabled();
    expect(onContinue).not.toHaveBeenCalled();

    resolvePlan({
      goal: 'FOUNDATION',
      estimatedLevel: 'A1',
      levelSource: 'BEGINNER_ASSUMED',
      placementAttemptId: null,
      generatedAt: new Date().toISOString(),
      aiSummary: null,
      aiPlanningUsed: true,
      items: [],
    });

    expect(await screen.findByRole('button', { name: /view my personal roadmap/i })).toBeEnabled();
    expect(onContinue).not.toHaveBeenCalled(); // navigation is a separate click now
  });

  it('clicking the primary button navigates once ready, without re-calling the planning API', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    renderResult(result(), onContinue);

    const button = await screen.findByRole('button', { name: /view my personal roadmap/i });
    await user.click(button);

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(mockRequestPlan).toHaveBeenCalledTimes(1);
  });

  // Onboarding must not trap the student: the backend's own guarantee is
  // that a deterministic roadmap already exists regardless of AI planning's
  // outcome, so even a network/auth error here must still let the CTA
  // become available (navigation itself still requires the click).
  it('still enables the primary button when the planning request itself fails', async () => {
    mockRequestPlan.mockRejectedValueOnce(new Error('network error'));
    renderResult(result());

    expect(await screen.findByRole('button', { name: /view my personal roadmap/i })).toBeEnabled();
  });

  it('renders a different friendly level name and encouragement for a higher level', () => {
    renderResult(result({ estimatedLevel: 'C1' }));
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });
});
