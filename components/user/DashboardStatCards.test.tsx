import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import DashboardStatCards from './DashboardStatCards';
import { DashboardAnalytics } from '../../services/analyticsService';

afterEach(cleanup);

const analytics = (overrides: Partial<DashboardAnalytics> = {}): DashboardAnalytics => ({
  effectiveTimeZone: 'UTC',
  today: {
    date: '2026-08-12',
    stagesCompleted: 0,
    taskAttempts: { quiz: 0, practice: 0, total: 0 },
    newWordsLearned: 0,
    wordsReviewed: 0,
    activeStudySeconds: 0,
  },
  activity: {
    windowDays: 7,
    days: [
      { date: '2026-08-06', active: true },
      { date: '2026-08-07', active: false },
      { date: '2026-08-08', active: true },
      { date: '2026-08-09', active: true },
      { date: '2026-08-10', active: false },
      { date: '2026-08-11', active: true },
      { date: '2026-08-12', active: true },
    ],
    currentStreakDays: 2,
    streakCapped: false,
  },
  recentAccuracyPercent: 82,
  ...overrides,
});

const renderCards = (props: Partial<Parameters<typeof DashboardStatCards>[0]> = {}) =>
  render(
    <LanguageProvider>
      <DashboardStatCards
        masteredWords={'masteredWords' in props ? props.masteredWords! : 126}
        analytics={'analytics' in props ? props.analytics : analytics()}
        totalCompletedLessons={
          'totalCompletedLessons' in props ? props.totalCompletedLessons! : 42
        }
        roadmapCompletionPercent={
          'roadmapCompletionPercent' in props ? props.roadmapCompletionPercent! : 68
        }
      />
    </LanguageProvider>,
  );

describe('DashboardStatCards', () => {
  it('renders the three real values once every source has resolved', () => {
    renderCards();

    expect(screen.getByText('126')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('68% of roadmap')).toBeInTheDocument();
  });

  it('shows a loading skeleton — not a fabricated 0 — for masteredWords while unknown', () => {
    const { container } = renderCards({ masteredWords: null });

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows a loading skeleton for accuracy while the analytics request is in flight', () => {
    const { container } = renderCards({ analytics: undefined });

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows a dash — not 0% — for accuracy when the student has never taken a graded attempt', () => {
    renderCards({ analytics: analytics({ recentAccuracyPercent: null }) });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('shows a dash for accuracy when the analytics request failed outright', () => {
    renderCards({ analytics: null });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('omits the roadmap-percent subtitle (not "0% of roadmap") when the student has no roadmap yet', () => {
    renderCards({ roadmapCompletionPercent: null });

    expect(screen.queryByText(/of roadmap/)).not.toBeInTheDocument();
  });
});
