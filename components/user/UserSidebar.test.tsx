import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import UserSidebar from './UserSidebar';
import { DashboardAnalytics } from '../../services/analyticsService';

// Sprint 09 — the right-rail widgets, which had NO test file before this.
//
// The property these tests exist to protect is the one Sprint 08 established
// for course progress and this sprint inherited: LOADING AND ERROR ARE STATES,
// NOT ZEROS. A failed analytics request that renders "0 stages today" is not an
// empty state — on a student who studied all morning it is a false statement,
// and nothing on screen would distinguish it from the truth.

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
  },
  activity: {
    windowDays: 7,
    days: [
      { date: '2026-07-25', active: false },
      { date: '2026-07-26', active: true },
      { date: '2026-07-27', active: true },
      { date: '2026-07-28', active: false },
      { date: '2026-07-29', active: true },
      { date: '2026-07-30', active: true },
      { date: '2026-07-31', active: true },
    ],
    currentStreakDays: 3,
    streakCapped: false,
  },
  ...overrides,
});

const renderSidebar = (
  props: {
    analytics?: DashboardAnalytics | null;
    onRetryAnalytics?: () => void;
  } = {},
) =>
  render(
    <LanguageProvider>
      <UserSidebar {...props} />
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('UserSidebar — loading state', () => {
  it('renders no numbers at all while the request is in flight', () => {
    renderSidebar({ analytics: undefined });

    expect(screen.queryByText(/stages done/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/words reviewed/i)).not.toBeInTheDocument();
    // And crucially, no zero standing in for "not yet known".
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('does not show an error while merely loading', () => {
    renderSidebar({ analytics: undefined });

    expect(
      screen.queryByText(/could not load your stats/i),
    ).not.toBeInTheDocument();
  });
});

describe('UserSidebar — error state', () => {
  it('says the stats failed and NEVER renders a zero instead', () => {
    renderSidebar({ analytics: null });

    expect(screen.getAllByText(/could not load your stats/i).length).toBe(2);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText(/stages done/i)).not.toBeInTheDocument();
  });

  it('offers a retry that calls back', async () => {
    const onRetryAnalytics = vi.fn();
    renderSidebar({ analytics: null, onRetryAnalytics });

    const retries = screen.getAllByRole('button', { name: /try again/i });
    expect(retries.length).toBe(2);

    await userEvent.click(retries[0]);
    expect(onRetryAnalytics).toHaveBeenCalledTimes(1);
  });

  it('omits the retry control when no handler is supplied', () => {
    renderSidebar({ analytics: null });

    expect(
      screen.queryByRole('button', { name: /try again/i }),
    ).not.toBeInTheDocument();
  });
});

// Each widget is a labelled <section>, so queries scope to one card. Several
// widgets legitimately contain the same words — the Achievements placeholder
// hint "Learn 100 new words" collides with the "New Words" row — and an
// unscoped query silently matches the wrong one.
const todayCard = () =>
  within(screen.getByRole('region', { name: /today's progress/i }));
const streakCard = () =>
  within(screen.getByRole('region', { name: /weekly streak/i }));

describe('UserSidebar — loaded state', () => {
  it('renders every today figure from the server payload', () => {
    renderSidebar({ analytics: analytics() });

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
    renderSidebar({ analytics: analytics() });

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
    renderSidebar({
      analytics: analytics({
        today: {
          date: '2026-07-31',
          stagesCompleted: 12,
          taskAttempts: { quiz: 0, practice: 0, total: 0 },
          newWordsLearned: 0,
          wordsReviewed: 0,
        },
      }),
    });

    const firstBar = todayCard().getAllByRole('progressbar')[0];
    expect(firstBar).toHaveAttribute('aria-valuenow', '100');
    expect(todayCard().getByText('12 / 5')).toBeInTheDocument();
  });

  // A real zero must look like a real zero. This is the counterpart to the
  // error tests above: the point is not "never show 0", it is "only show 0 when
  // it is true".
  it('renders honest zeros for a student who has not studied today', () => {
    renderSidebar({
      analytics: analytics({
        today: {
          date: '2026-07-31',
          stagesCompleted: 0,
          taskAttempts: { quiz: 0, practice: 0, total: 0 },
          newWordsLearned: 0,
          wordsReviewed: 0,
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
    expect(
      screen.queryByText(/could not load your stats/i),
    ).not.toBeInTheDocument();
  });

  it('renders one tile per day in the activity window', () => {
    renderSidebar({ analytics: analytics() });

    // Five active days in the fixture -> five ticks.
    expect(streakCard().getAllByTitle(/^2026-07-/)).toHaveLength(7);
    expect(streakCard().getAllByText('✓')).toHaveLength(5);
  });

  it('shows the streak count without a plus when the window is not full', () => {
    renderSidebar({ analytics: analytics() });

    expect(streakCard().getAllByText(/3 days/).length).toBeGreaterThan(0);
    expect(streakCard().queryByText(/3\+ days/)).not.toBeInTheDocument();
  });

  // The honest-truncation rule: a 40-day streak cannot be seen through a
  // 7-day window, so it must not be reported as exactly 7.
  it('marks a capped streak with a plus', () => {
    renderSidebar({
      analytics: analytics({
        activity: {
          windowDays: 7,
          days: [
            '2026-07-25',
            '2026-07-26',
            '2026-07-27',
            '2026-07-28',
            '2026-07-29',
            '2026-07-30',
            '2026-07-31',
          ].map((date) => ({ date, active: true })),
          currentStreakDays: 7,
          streakCapped: true,
        },
      }),
    });

    expect(streakCard().getAllByText(/7\+ days/).length).toBeGreaterThan(0);
  });
});

describe('UserSidebar — the widgets that are still placeholder', () => {
  // If someone wires Daily Goal or Achievements to real data, these fail and
  // remind them to drop the marker. The reverse matters more: the marker must
  // never reappear on the two widgets that became real.
  it('keeps the sample-data marker on Daily Goal ALONE', () => {
    // Was two markers (Daily Goal + Achievements). Sprint 10 made Achievements
    // real from the XP ledger and removed its marker along with the mock, so
    // exactly ONE placeholder is left on this rail.
    //
    // Daily Goal keeps its marker because it still has nothing behind it:
    // there is no time-on-task signal anywhere in the product. This count is
    // asserted rather than left implicit so that shipping a real Daily Goal
    // without removing its label — or adding a new placeholder quietly — turns
    // this red.
    renderSidebar({ analytics: analytics() });

    expect(screen.getAllByText(/sample data/i)).toHaveLength(1);
  });

  it('does not label the real widgets as sample data', () => {
    renderSidebar({ analytics: analytics() });

    expect(todayCard().queryByText(/sample data/i)).not.toBeInTheDocument();
    expect(streakCard().queryByText(/sample data/i)).not.toBeInTheDocument();
  });
});
