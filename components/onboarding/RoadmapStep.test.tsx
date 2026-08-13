import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import RoadmapStep from './RoadmapStep';
import { RoadmapItemView, RoadmapView } from '../../services/placementService';
import { CourseProgressSummary } from '../../services/courseProgressService';

vi.mock('../../services/placementService', () => ({
  getPlacementRoadmap: vi.fn(),
}));
vi.mock('../../services/courseProgressService', async () => {
  const actual = await vi.importActual<typeof import('../../services/courseProgressService')>(
    '../../services/courseProgressService',
  );
  return { ...actual, getCourseProgressSummaries: vi.fn() };
});
vi.mock('../../services/analyticsService', () => ({
  getDashboardAnalytics: vi.fn(),
}));

import { getPlacementRoadmap } from '../../services/placementService';
import { getCourseProgressSummaries } from '../../services/courseProgressService';
import { getDashboardAnalytics } from '../../services/analyticsService';

const mockGetRoadmap = vi.mocked(getPlacementRoadmap);
const mockGetProgress = vi.mocked(getCourseProgressSummaries);
const mockGetAnalytics = vi.mocked(getDashboardAnalytics);

const item = (phase: number, courseId: string): RoadmapItemView => ({
  phase,
  pillar: 'GRAMMAR',
  resourceType: 'COURSE',
  resourceId: courseId,
  resourceTitle: `Course ${phase}`,
  resourceThumbnail: null,
  reason: `Reason ${phase}`,
  totalEstimatedMinutes: 240,
});

const libraryItem = (phase: number, resourceId: string): RoadmapItemView => ({
  phase,
  pillar: 'VOCABULARY',
  resourceType: 'VOCAB_LIBRARY',
  resourceId,
  resourceTitle: `Library ${phase}`,
  resourceThumbnail: null,
  reason: `Reason ${phase}`,
  totalEstimatedMinutes: 0,
});

const roadmap = (
  items: RoadmapItemView[],
  overrides: Partial<RoadmapView> = {},
): RoadmapView => ({
  goal: 'TOEIC_450',
  estimatedLevel: 'B1',
  levelSource: 'TEST_GRADED',
  placementAttemptId: 'attempt-1',
  generatedAt: new Date().toISOString(),
  aiSummary: null,
  aiPlanningUsed: false,
  items,
  ...overrides,
});

const summary = (courseId: string, overrides: Partial<CourseProgressSummary> = {}): CourseProgressSummary => ({
  courseId,
  totalLessons: 10,
  completedLessons: 5,
  inProgressLessons: 1,
  notStartedLessons: 4,
  progressPercent: 50,
  status: 'IN_PROGRESS',
  continueLessonId: null,
  lessons: null,
  ...overrides,
});

const analytics = (currentStreakDays: number) => ({
  effectiveTimeZone: 'UTC',
  today: {
    date: '2026-08-12',
    stagesCompleted: 0,
    taskAttempts: { quiz: 0, practice: 0, total: 0 },
    newWordsLearned: 0,
    wordsReviewed: 0,
    activeStudySeconds: 0,
  },
  activity: { windowDays: 7, days: [], currentStreakDays, streakCapped: false },
  recentAccuracyPercent: null,
});

const renderStep = (onFinished = vi.fn()) =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <RoadmapStep onFinished={onFinished} />
      </MemoryRouter>
    </LanguageProvider>,
  );

describe('RoadmapStep', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the roadmap and the Goal stat immediately, without waiting on the progress/streak requests', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1'), item(2, 'c2')]));
    // Deliberately never resolved within this test — the roadmap must not
    // depend on these to render.
    mockGetProgress.mockReturnValue(new Promise(() => {}));
    mockGetAnalytics.mockReturnValue(new Promise(() => {}));

    renderStep();

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
    expect(screen.getByText('Course 2')).toBeInTheDocument();
    expect(screen.getByText('Reach TOEIC 450')).toBeInTheDocument();
  });

  it('degrades silently (dash, no crash) when the course-progress request fails', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1')]));
    mockGetProgress.mockRejectedValueOnce(new Error('network error'));
    mockGetAnalytics.mockResolvedValueOnce(analytics(3));

    renderStep();

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
    // The streak stat, from an independent request, still resolves normally.
    expect(await screen.findByText('3 days')).toBeInTheDocument();
  });

  it('degrades silently when the streak request fails — the roadmap and progress stat still render', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1')]));
    mockGetProgress.mockResolvedValueOnce(new Map([['c1', summary('c1', { progressPercent: 40, totalLessons: 10, completedLessons: 4 })]]));
    mockGetAnalytics.mockRejectedValueOnce(new Error('network error'));

    renderStep();

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
    expect(await screen.findByText('40%')).toBeInTheDocument();
  });

  it('hides the collapse/expand toggle when there are 3 or fewer phases', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1'), item(2, 'c2'), item(3, 'c3')]));
    mockGetProgress.mockResolvedValueOnce(new Map());
    mockGetAnalytics.mockResolvedValueOnce(analytics(0));

    renderStep();

    expect(await screen.findByText('Course 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /collapse|expand/i })).not.toBeInTheDocument();
  });

  it('shows the toggle and starts expanded (all phases visible) when there are more than 3', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap([item(1, 'c1'), item(2, 'c2'), item(3, 'c3'), item(4, 'c4')]),
    );
    mockGetProgress.mockResolvedValueOnce(new Map());
    mockGetAnalytics.mockResolvedValueOnce(analytics(0));
    const user = userEvent.setup();

    renderStep();

    expect(await screen.findByText('Course 4')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /collapse/i });

    await user.click(toggle);
    expect(screen.queryByText('Course 4')).not.toBeInTheDocument();
    expect(screen.getByText('Course 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand/i }));
    expect(screen.getByText('Course 4')).toBeInTheDocument();
  });

  it('renders lesson count, progress and a status action link per phase, sourced from the batch progress endpoint', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1')]));
    mockGetProgress.mockResolvedValueOnce(
      new Map([['c1', summary('c1', { status: 'IN_PROGRESS', totalLessons: 24, progressPercent: 60 })]]),
    );
    mockGetAnalytics.mockResolvedValueOnce(analytics(7));

    renderStep();

    expect(await screen.findByText('24 Lessons')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/courses/c1');
  });

  it('shows the "Current progress" and "Day streak" stats once both requests resolve', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1')]));
    mockGetProgress.mockResolvedValueOnce(
      new Map([['c1', summary('c1', { totalLessons: 10, completedLessons: 5 })]]),
    );
    mockGetAnalytics.mockResolvedValueOnce(analytics(9));

    renderStep();

    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(await screen.findByText('9 days')).toBeInTheDocument();
  });

  it('renders a VOCAB_LIBRARY item with a plain "View" link and no fabricated progress bar', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1'), libraryItem(2, 'lib-1')]));
    mockGetProgress.mockResolvedValueOnce(
      new Map([['c1', summary('c1', { totalLessons: 10, completedLessons: 5 })]]),
    );
    mockGetAnalytics.mockResolvedValueOnce(analytics(0));

    renderStep();

    expect(await screen.findByText('Library 2')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View' }),
    ).toHaveAttribute('href', '/vocab/libraries/lib-1');
  });

  it('shows the AI planner\'s overall summary as soon as the roadmap loads, with no separate fetch', async () => {
    mockGetRoadmap.mockResolvedValueOnce(
      roadmap([item(1, 'c1')], { aiSummary: 'Ưu tiên Nghe và Ngữ pháp trước khi tới TOEIC 450.' }),
    );
    mockGetProgress.mockResolvedValueOnce(new Map());
    mockGetAnalytics.mockResolvedValueOnce(analytics(0));

    renderStep();

    expect(
      await screen.findByText('Ưu tiên Nghe và Ngữ pháp trước khi tới TOEIC 450.'),
    ).toBeInTheDocument();
  });

  it('renders no AI-summary section at all when aiSummary is null', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1')], { aiSummary: null }));
    mockGetProgress.mockResolvedValueOnce(new Map());
    mockGetAnalytics.mockResolvedValueOnce(analytics(0));

    renderStep();

    await screen.findByText('Course 1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The heading/subtitle text is the only place "roadmap" copy exists —
    // no orphaned summary paragraph should appear.
    expect(screen.queryByText(/Ưu tiên/)).not.toBeInTheDocument();
  });

  it('calls onFinished when the bottom CTA is clicked', async () => {
    mockGetRoadmap.mockResolvedValueOnce(roadmap([item(1, 'c1')]));
    mockGetProgress.mockResolvedValueOnce(new Map());
    mockGetAnalytics.mockResolvedValueOnce(analytics(0));
    const onFinished = vi.fn();
    const user = userEvent.setup();

    renderStep(onFinished);

    await user.click(await screen.findByRole('button', { name: /go to my dashboard/i }));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
