import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import RoadmapCard from './RoadmapCard';
import { ApiError } from '../../services/apiError';

// Self-contained component (own GET /placement/roadmap fetch on mount, plus
// an on-demand POST for the AI narrative) — mocked the same way
// ReviewSessionPage.test.tsx mocks its own service module, rather than
// passed as props like the sibling dashboard cards.
vi.mock('../../services/placementService', () => ({
  getPlacementRoadmap: vi.fn(),
  requestPlacementRoadmapAnalysis: vi.fn(),
}));

vi.mock('../../services/courseProgressService', async () => {
  const actual = await vi.importActual<typeof import('../../services/courseProgressService')>(
    '../../services/courseProgressService',
  );
  return {
    ...actual,
    getCourseProgressSummaries: vi.fn(),
  };
});

import {
  getPlacementRoadmap,
  requestPlacementRoadmapAnalysis,
} from '../../services/placementService';
import { getCourseProgressSummaries } from '../../services/courseProgressService';

const mockGetRoadmap = vi.mocked(getPlacementRoadmap);
const mockRequestAnalysis = vi.mocked(requestPlacementRoadmapAnalysis);
const mockGetProgress = vi.mocked(getCourseProgressSummaries);

const roadmap = (overrides: Record<string, unknown> = {}) => ({
  goal: 'TOEIC_450' as const,
  estimatedLevel: 'B1' as const,
  placementAttemptId: 'attempt-1',
  generatedAt: '2026-08-01T00:00:00.000Z',
  aiSummary: null,
  items: [
    {
      phase: 1,
      courseType: 'VOCABULARY' as const,
      courseId: 'course-1',
      courseTitle: 'Core TOEIC Vocabulary',
      courseThumbnail: null,
      reason: 'Weakest section — recommended first.',
      // 420 / (30 min/day target * 7) = exactly 2 weeks — a clean, testable
      // round number for the "~X tuần" estimate tag.
      totalEstimatedMinutes: 420,
    },
  ],
  ...overrides,
});

const progressSummary = (overrides: Record<string, unknown> = {}) => ({
  courseId: 'course-1',
  totalLessons: 20,
  completedLessons: 5,
  inProgressLessons: 1,
  notStartedLessons: 14,
  progressPercent: 25,
  status: 'IN_PROGRESS' as const,
  continueLessonId: 'lesson-9',
  lessons: null,
  ...overrides,
});

const renderCard = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RoadmapCard />} />
          <Route path="/onboarding/retake" element={<div>RETAKE_STUB</div>} />
          <Route path="/courses/:id" element={<div>COURSE_DETAIL_STUB</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

beforeEach(() => {
  // Baseline so every test that merely renders the ready-state phase list
  // doesn't have to care about the progress fetch — tests that DO care
  // override with their own mockResolvedValueOnce/mockRejectedValueOnce.
  mockGetProgress.mockResolvedValue(new Map());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RoadmapCard', () => {
  it('prompts to create a roadmap when GET /placement/roadmap 404s (pre-migration accounts, or nobody has onboarded yet)', async () => {
    mockGetRoadmap.mockRejectedValueOnce(new ApiError('not found', 404));
    renderCard();

    expect(
      await screen.findByText('No personalized roadmap yet'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /create my roadmap/i }),
    ).toHaveAttribute('href', '/onboarding/retake');
  });

  it('renders nothing (not a permanent skeleton) when the fetch fails for a reason other than 404', async () => {
    mockGetRoadmap.mockRejectedValueOnce(new ApiError('server error', 500));
    const { container } = renderCard();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders the goal, estimated level, phase list and a retake link once the roadmap loads', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap());
    renderCard();

    // Goal and level share one paragraph ("Reach TOEIC 450 · Estimated
    // level: B1"), so each is matched as a substring, not an exact string.
    expect(await screen.findByText(/Reach TOEIC 450/)).toBeInTheDocument();
    expect(screen.getByText(/B1/)).toBeInTheDocument();
    expect(screen.getByText('Core TOEIC Vocabulary')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /retake the placement test/i }),
    ).toHaveAttribute('href', '/onboarding/retake');
    expect(
      screen.getByRole('link', { name: /core toeic vocabulary/i }),
    ).toHaveAttribute('href', '/courses/course-1');
  });

  it('shows a stored AI summary directly, with no button to fetch it again', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({ aiSummary: 'This is your personalized narrative.' }),
    );
    renderCard();

    expect(
      await screen.findByText('This is your personalized narrative.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ai insights/i }),
    ).not.toBeInTheDocument();
  });

  it('requests the AI analysis on click and displays the result once it resolves', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap());
    mockRequestAnalysis.mockResolvedValueOnce({
      summary: 'Freshly generated insight.',
      generatedAt: '2026-08-11T00:00:00.000Z',
      model: 'gemini-2.5-flash',
      cached: false,
    });
    renderCard();

    const button = await screen.findByRole('button', { name: /ai insights/i });
    await userEvent.click(button);

    expect(await screen.findByText('Freshly generated insight.')).toBeInTheDocument();
    expect(mockRequestAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /ai insights/i })).not.toBeInTheDocument();
  });

  it('shows an inline error and keeps the button available to retry when analysis generation fails', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap());
    // handleAuthError surfaces the backend's own message when there is one
    // (see apiError.ts) — matching QuizStage's verified-correct
    // `handleAuthError(err, navigate) || fallback` pattern, so the fallback
    // copy is only what a message-less rejection would show.
    mockRequestAnalysis.mockRejectedValueOnce(
      new ApiError('AI roadmap analysis is unavailable. Please try again shortly.', 503),
    );
    renderCard();

    const button = await screen.findByRole('button', { name: /ai insights/i });
    await userEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AI roadmap analysis is unavailable. Please try again shortly.',
    );
    expect(screen.getByRole('button', { name: /ai insights/i })).toBeInTheDocument();
  });

  it('falls back to generic copy when the rejection carries no usable message', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap());
    mockRequestAnalysis.mockRejectedValueOnce(new ApiError('', 503));
    renderCard();

    const button = await screen.findByRole('button', { name: /ai insights/i });
    await userEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not generate insights.');
  });

  it('renders lesson count and progress bar percentage once course progress loads', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap());
    mockGetProgress.mockResolvedValueOnce(
      new Map([['course-1', progressSummary({ totalLessons: 20, progressPercent: 25 })]]),
    );
    renderCard();

    expect(await screen.findByText('20 Lessons')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('shows an estimated-weeks tag derived from real totalEstimatedMinutes, rounded up', async () => {
    // 420 minutes / (30 min/day target * 7) = exactly 2 weeks.
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [
          {
            phase: 1,
            courseType: 'VOCABULARY',
            courseId: 'course-1',
            courseTitle: 'Core TOEIC Vocabulary',
            courseThumbnail: null,
            reason: 'reason',
            totalEstimatedMinutes: 420,
          },
        ],
      }),
    );
    renderCard();

    expect(await screen.findByText('~2 weeks')).toBeInTheDocument();
  });

  it('omits the estimated-weeks tag for a course with no lessons carrying a duration, rather than showing "~0 weeks"', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [
          {
            phase: 1,
            courseType: 'VOCABULARY',
            courseId: 'course-1',
            courseTitle: 'Core TOEIC Vocabulary',
            courseThumbnail: null,
            reason: 'reason',
            totalEstimatedMinutes: 0,
          },
        ],
      }),
    );
    renderCard();

    expect(await screen.findByText('Core TOEIC Vocabulary')).toBeInTheDocument();
    expect(screen.queryByText(/weeks/)).not.toBeInTheDocument();
  });

  it('links an IN_PROGRESS phase to its continue-lesson path, not the plain course page', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap());
    mockGetProgress.mockResolvedValueOnce(
      new Map([
        [
          'course-1',
          progressSummary({ status: 'IN_PROGRESS', continueLessonId: 'lesson-9' }),
        ],
      ]),
    );
    renderCard();

    // The link exists (and already matches this query) before the progress
    // fetch resolves too — its href is only the continue-lesson path AFTER
    // that re-render, so wait for progress-dependent content first or this
    // assertion can race the mocked promise and catch the pre-progress
    // fallback href instead.
    await screen.findByText('25%');

    expect(screen.getByRole('link', { name: /core toeic vocabulary/i })).toHaveAttribute(
      'href',
      '/courses/course-1/lessons/lesson-9',
    );
  });

  it('renders a course thumbnail image when the roadmap item has one', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [
          {
            phase: 1,
            courseType: 'VOCABULARY',
            courseId: 'course-1',
            courseTitle: 'Core TOEIC Vocabulary',
            courseThumbnail: 'https://example.com/thumb.jpg',
            reason: 'Weakest section — recommended first.',
            totalEstimatedMinutes: 420,
          },
        ],
      }),
    );
    renderCard();

    const link = await screen.findByRole('link', { name: /core toeic vocabulary/i });
    expect(link.querySelector('img')).toHaveAttribute('src', 'https://example.com/thumb.jpg');
  });

  it('does not render the collapse/expand toggle for 3 or fewer phases, and shows every phase', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [1, 2, 3].map((phase) => ({
          phase,
          courseType: 'VOCABULARY' as const,
          courseId: `course-${phase}`,
          courseTitle: `Phase ${phase} Course`,
          courseThumbnail: null,
          reason: 'reason',
          totalEstimatedMinutes: 420,
        })),
      }),
    );
    renderCard();

    expect(await screen.findByText('Phase 3 Course')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
  });

  it('collapses to the first 3 phases behind a "View all" toggle when there are more than 3', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [1, 2, 3, 4].map((phase) => ({
          phase,
          courseType: 'VOCABULARY' as const,
          courseId: `course-${phase}`,
          courseTitle: `Phase ${phase} Course`,
          courseThumbnail: null,
          reason: 'reason',
          totalEstimatedMinutes: 420,
        })),
      }),
    );
    const user = userEvent.setup();
    renderCard();

    await screen.findByText('Phase 1 Course');
    expect(screen.queryByText('Phase 4 Course')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view all/i }));

    expect(screen.getByText('Phase 4 Course')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
  });
});
