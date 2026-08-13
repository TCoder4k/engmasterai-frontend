import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import RoadmapCard from './RoadmapCard';
import { ApiError } from '../../services/apiError';

// Self-contained component (own GET /placement/roadmap fetch on mount) —
// mocked the same way ReviewSessionPage.test.tsx mocks its own service
// module, rather than passed as props like the sibling dashboard cards.
// NO requestPlacementRoadmapAnalysis mock: the dashboard never calls it —
// aiSummary is populated automatically during onboarding, not on-demand.
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
  levelSource: 'TEST_GRADED' as const,
  placementAttemptId: 'attempt-1',
  generatedAt: '2026-08-01T00:00:00.000Z',
  aiSummary: null,
  aiPlanningUsed: false,
  items: [
    {
      phase: 1,
      pillar: 'VOCABULARY' as const,
      resourceType: 'COURSE' as const,
      resourceId: 'course-1',
      resourceTitle: 'Core TOEIC Vocabulary',
      resourceThumbnail: null,
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
          <Route path="/vocab/libraries/:id" element={<div>LIBRARY_DETAIL_STUB</div>} />
          <Route path="/practice/listening" element={<div>LISTENING_CATALOG_STUB</div>} />
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

  it('shows a stored AI summary directly, with no button of any kind to fetch it again', async () => {
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

  it('never calls requestPlacementRoadmapAnalysis, even when aiSummary is null — no background retry', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap({ aiSummary: null }));
    renderCard();

    await screen.findByText('Core TOEIC Vocabulary');
    // Give any stray background effect a tick to have fired.
    await waitFor(() => expect(mockGetProgress).toHaveBeenCalled());
    expect(mockRequestAnalysis).not.toHaveBeenCalled();
  });

  it('renders no AI-narrative section at all when aiSummary is null', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap({ aiSummary: null }));
    renderCard();

    await screen.findByText('Core TOEIC Vocabulary');
    expect(screen.queryByRole('button', { name: /ai/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
            pillar: 'VOCABULARY',
            resourceType: 'COURSE',
            resourceId: 'course-1',
            resourceTitle: 'Core TOEIC Vocabulary',
            resourceThumbnail: null,
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
            pillar: 'VOCABULARY',
            resourceType: 'COURSE',
            resourceId: 'course-1',
            resourceTitle: 'Core TOEIC Vocabulary',
            resourceThumbnail: null,
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
            pillar: 'VOCABULARY',
            resourceType: 'COURSE',
            resourceId: 'course-1',
            resourceTitle: 'Core TOEIC Vocabulary',
            resourceThumbnail: 'https://example.com/thumb.jpg',
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

  it('routes a VOCAB_LIBRARY item to its library detail page, with no progress bar', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [
          {
            phase: 1,
            pillar: 'VOCABULARY',
            resourceType: 'VOCAB_LIBRARY',
            resourceId: 'lib-1',
            resourceTitle: '1000 Từ Tiếng Anh Thông Dụng',
            resourceThumbnail: null,
            reason: 'Điểm khởi đầu cho phần từ vựng.',
            totalEstimatedMinutes: 0,
          },
        ],
      }),
    );
    renderCard();

    const link = await screen.findByRole('link', { name: /1000 từ tiếng anh thông dụng/i });
    expect(link).toHaveAttribute('href', '/vocab/libraries/lib-1');
    expect(screen.queryByText(/weeks/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lessons/i)).not.toBeInTheDocument();
  });

  it('routes a LISTENING_CATEGORY item to the listening catalog, preselecting the category via router state', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [
          {
            phase: 1,
            pillar: 'LISTENING',
            resourceType: 'LISTENING_CATEGORY',
            resourceId: 'cat-1',
            resourceTitle: 'Hội thoại hằng ngày',
            resourceThumbnail: null,
            reason: 'Điểm khởi đầu cho phần kỹ năng nghe.',
            totalEstimatedMinutes: 0,
          },
        ],
      }),
    );
    renderCard();

    const link = await screen.findByRole('link', { name: /hội thoại hằng ngày/i });
    expect(link).toHaveAttribute('href', '/practice/listening');
  });

  it('does not render the collapse/expand toggle for 3 or fewer phases, and shows every phase', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap({
        items: [1, 2, 3].map((phase) => ({
          phase,
          pillar: 'VOCABULARY' as const,
          resourceType: 'COURSE' as const,
          resourceId: `course-${phase}`,
          resourceTitle: `Phase ${phase} Course`,
          resourceThumbnail: null,
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
          pillar: 'VOCABULARY' as const,
          resourceType: 'COURSE' as const,
          resourceId: `course-${phase}`,
          resourceTitle: `Phase ${phase} Course`,
          resourceThumbnail: null,
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
