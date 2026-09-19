import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import TodaysProgressWidget from './TodaysProgressWidget';
import { DashboardAnalytics } from '../../services/analyticsService';

// Extracted out of UserSidebar.test.tsx (dashboard redesign, 2026-09) when
// Today's Progress moved out of the right rail into UserHome's main content
// column. Same fixtures, same property under test: LOADING AND ERROR ARE
// STATES, NOT ZEROS — a failed request must never render as "0 stages
// today", which on a student who studied all morning would be a false
// statement, not an empty state.

const analytics = (
  overrides: Partial<DashboardAnalytics> = {},
): DashboardAnalytics => ({
  effectiveTimeZone: 'Asia/Ho_Chi_Minh',
  today: {
    date: '2026-07-31',
    stagesCompleted: 3,
    taskAttempts: { quiz: 2, practice: 1, total: 3 },
    newWordsLearned: 12,
    wordsReviewed: 40,
    activeStudySeconds: 1_080,
  },
  activity: {
    windowDays: 7,
    days: [],
    currentStreakDays: 3,
    streakCapped: false,
  },
  recentAccuracyPercent: 82,
  ...overrides,
});

const renderWidget = (
  props: {
    analytics?: DashboardAnalytics | null;
    onRetryAnalytics?: () => void;
  } = {},
) =>
  render(
    <LanguageProvider>
      <TodaysProgressWidget {...props} />
    </LanguageProvider>,
  );

afterEach(() => cleanup());

const todayCard = () =>
  within(screen.getByRole('region', { name: /today's progress/i }));

describe('TodaysProgressWidget — loading state', () => {
  it('renders no numbers at all while the request is in flight', () => {
    renderWidget({ analytics: undefined });

    expect(screen.queryByText(/stages done/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/words reviewed/i)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('does not show an error while merely loading', () => {
    renderWidget({ analytics: undefined });

    expect(screen.queryByText(/could not load your stats/i)).not.toBeInTheDocument();
  });
});

describe('TodaysProgressWidget — error state', () => {
  it('says the stats failed and NEVER renders a zero instead', () => {
    renderWidget({ analytics: null });

    expect(screen.getByText(/could not load your stats/i)).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText(/stages done/i)).not.toBeInTheDocument();
  });

  it('offers a retry that calls back', async () => {
    const onRetryAnalytics = vi.fn();
    renderWidget({ analytics: null, onRetryAnalytics });

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetryAnalytics).toHaveBeenCalledTimes(1);
  });

  it('omits the retry control when no handler is supplied', () => {
    renderWidget({ analytics: null });

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe('TodaysProgressWidget — loaded state', () => {
  it('renders every today figure from the server payload', () => {
    renderWidget({ analytics: analytics() });

    const rows = todayCard().getAllByRole('term').map((dt) => dt.textContent);
    expect(rows).toEqual([
      'Stages done',
      'Practice attempts',
      'New Words',
      'Words reviewed',
    ]);

    // Value is server-derived, target is the product default (dailyTargets.ts).
    const values = todayCard()
      .getAllByRole('definition')
      .map((dd) => dd.textContent);
    expect(values).toEqual(['3 / 5', '3 / 3', '12 / 20', '40 / 50']);
  });

  it('sizes each bar against its target', () => {
    renderWidget({ analytics: analytics() });

    const bars = todayCard().getAllByRole('progressbar');
    expect(bars.map((bar) => bar.getAttribute('aria-valuenow'))).toEqual([
      '60', // 3 / 5
      '100', // 3 / 3
      '60', // 12 / 20
      '80', // 40 / 50
    ]);
  });

  // Beating a target is common and good. The bar must fill, not overflow, and
  // the real count must still be visible beside it.
  it('clamps a bar at 100% when the target is exceeded, without hiding the count', () => {
    renderWidget({
      analytics: analytics({
        today: {
          date: '2026-07-31',
          stagesCompleted: 12,
          taskAttempts: { quiz: 0, practice: 0, total: 0 },
          newWordsLearned: 0,
          wordsReviewed: 0,
          activeStudySeconds: 0,
        },
      }),
    });

    const firstBar = todayCard().getAllByRole('progressbar')[0];
    expect(firstBar).toHaveAttribute('aria-valuenow', '100');
    expect(todayCard().getByText('12 / 5')).toBeInTheDocument();
  });

  // A real zero must look like a real zero. This is the counterpart to the
  // error tests above: the point is not "never show 0", it is "only show 0
  // when it is true".
  it('renders honest zeros for a student who has not studied today', () => {
    renderWidget({
      analytics: analytics({
        today: {
          date: '2026-07-31',
          stagesCompleted: 0,
          taskAttempts: { quiz: 0, practice: 0, total: 0 },
          newWordsLearned: 0,
          wordsReviewed: 0,
          activeStudySeconds: 0,
        },
      }),
    });

    const values = todayCard()
      .getAllByRole('definition')
      .map((dd) => dd.textContent);
    expect(values).toEqual(['0 / 5', '0 / 3', '0 / 20', '0 / 50']);
    expect(
      todayCard()
        .getAllByRole('progressbar')
        .map((bar) => bar.getAttribute('aria-valuenow')),
    ).toEqual(['0', '0', '0', '0']);
    expect(screen.queryByText(/could not load your stats/i)).not.toBeInTheDocument();
  });

  it('carries no sample-data marker', () => {
    renderWidget({ analytics: analytics() });

    expect(todayCard().queryByText(/sample data/i)).not.toBeInTheDocument();
  });
});
