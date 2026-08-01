import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { GamificationProvider } from '../shared/GamificationProvider';
import LevelWidget from './LevelWidget';
import AchievementsWidget from './AchievementsWidget';
import * as gamificationService from '../../services/gamificationService';
import { GamificationProfile } from '../../services/gamificationService';

// Sprint 10 — the two widgets that replaced placeholders.
//
// THE RULE THEY BOTH EXIST TO OBEY: loading and error are STATES, never zeros.
// Rendering "Level 1 / 0 XP" or an empty trophy case because a request failed
// is a false statement about a student who has been studying for weeks, and
// nothing on screen would distinguish it from the truth. Sprint 08 set this for
// course progress and Sprint 09 for the dashboard; these inherit it.

const profile = (
  overrides: Partial<GamificationProfile> = {},
): GamificationProfile => ({
  xp: { totalXp: 1240, level: 6, intoLevel: 240, toNextLevel: 110, percent: 68 },
  achievements: [
    {
      key: 'FIRST_STAGE',
      xp: 20,
      unlockedAt: '2026-08-02T10:00:00.000Z',
      progress: null,
    },
    {
      key: 'FIRST_QUIZ_PASS',
      xp: 20,
      unlockedAt: null,
      progress: { current: 0, target: 1 },
    },
    {
      key: 'FIRST_MASTERED_WORD',
      xp: 20,
      unlockedAt: null,
      progress: { current: 0, target: 1 },
    },
    { key: 'STREAK_3', xp: 25, unlockedAt: null, progress: null },
    { key: 'STREAK_7', xp: 60, unlockedAt: null, progress: null },
    {
      key: 'XP_500',
      xp: 100,
      unlockedAt: null,
      progress: { current: 240, target: 500 },
    },
  ],
  nextMilestoneDays: 3,
  ...overrides,
});

const renderWidgets = () =>
  render(
    <LanguageProvider>
      <GamificationProvider>
        <LevelWidget />
        <AchievementsWidget />
      </GamificationProvider>
    </LanguageProvider>,
  );

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi
    .spyOn(gamificationService, 'getGamificationProfile')
    .mockResolvedValue(profile());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const levelCard = () =>
  within(screen.getByRole('region', { name: /level/i }));
const achievementsCard = () =>
  within(screen.getByRole('region', { name: /achievements/i }));

describe('LevelWidget', () => {
  it('renders the server-derived level and XP', async () => {
    renderWidgets();

    await waitFor(() =>
      expect(levelCard().getByText(/level 6/i)).toBeInTheDocument(),
    );
    expect(levelCard().getByText(/1240 XP/)).toBeInTheDocument();
    expect(levelCard().getByText(/110 XP to next level/i)).toBeInTheDocument();
  });

  it('exposes the progress bar with its real value', async () => {
    renderWidgets();

    await waitFor(() =>
      expect(levelCard().getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '68',
      ),
    );
  });

  it('shows NO numbers while loading', async () => {
    renderWidgets();

    // Before the promise resolves there is no level and no zero standing in
    // for one.
    expect(levelCard().queryByText(/level \d/i)).not.toBeInTheDocument();
    expect(levelCard().queryByText(/0 XP/)).not.toBeInTheDocument();
    expect(levelCard().queryByRole('progressbar')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(levelCard().getByText(/level 6/i)).toBeInTheDocument(),
    );
  });

  it('says the request failed and NEVER falls back to level 1', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    renderWidgets();

    await waitFor(() =>
      expect(
        levelCard().getByText(/could not load your stats/i),
      ).toBeInTheDocument(),
    );
    expect(levelCard().queryByText(/level 1/i)).not.toBeInTheDocument();
    expect(levelCard().queryByText(/0 XP/)).not.toBeInTheDocument();
  });

  it('offers a retry after a failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    renderWidgets();
    await waitFor(() =>
      expect(
        levelCard().getByText(/could not load your stats/i),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      levelCard().getByRole('button', { name: /try again/i }),
    );
    await waitFor(() =>
      expect(levelCard().getByText(/level 6/i)).toBeInTheDocument(),
    );
  });

  it('renders an honest level 1 for a genuinely new account', async () => {
    // The counterpart to the error test: the rule is not "never show level 1",
    // it is "only show it when it is true".
    fetchSpy.mockResolvedValueOnce(
      profile({
        xp: {
          totalXp: 0,
          level: 1,
          intoLevel: 0,
          toNextLevel: 100,
          percent: 0,
        },
      }),
    );
    renderWidgets();

    await waitFor(() =>
      expect(levelCard().getByText(/level 1/i)).toBeInTheDocument(),
    );
    expect(levelCard().getByText(/0 XP/)).toBeInTheDocument();
    expect(
      levelCard().queryByText(/could not load your stats/i),
    ).not.toBeInTheDocument();
  });
});

describe('AchievementsWidget', () => {
  it('renders the whole six-badge catalog, locked ones included', async () => {
    renderWidgets();

    await waitFor(() =>
      expect(achievementsCard().getByText('First Stage')).toBeInTheDocument(),
    );
    expect(achievementsCard().getAllByRole('listitem')).toHaveLength(6);
    expect(achievementsCard().getByText('3 Day Streak')).toBeInTheDocument();
    expect(achievementsCard().getByText('500 XP')).toBeInTheDocument();
  });

  it('carries locked/unlocked in TEXT, not colour alone', async () => {
    renderWidgets();

    await waitFor(() =>
      expect(achievementsCard().getByText('First Stage')).toBeInTheDocument(),
    );
    expect(achievementsCard().getAllByText(/— unlocked/)).toHaveLength(1);
    expect(achievementsCard().getAllByText(/— locked/)).toHaveLength(5);
  });

  it('shows progress toward a countable locked badge', async () => {
    renderWidgets();

    await waitFor(() =>
      expect(achievementsCard().getByText(/240\/500/)).toBeInTheDocument(),
    );
  });

  it('shows NO progress figure for streak badges', async () => {
    renderWidgets();

    await waitFor(() =>
      expect(achievementsCard().getByText('3 Day Streak')).toBeInTheDocument(),
    );
    const streakRow = achievementsCard()
      .getByText('3 Day Streak')
      .closest('li');
    expect(streakRow?.textContent).not.toMatch(/\d+\/\d+/);
  });

  it('never renders an empty trophy case on failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    renderWidgets();

    await waitFor(() =>
      expect(
        achievementsCard().getByText(/could not load your stats/i),
      ).toBeInTheDocument(),
    );
    expect(achievementsCard().queryAllByRole('listitem')).toHaveLength(0);
  });

  it('carries NO "sample data" marker — it is real now', async () => {
    renderWidgets();

    await waitFor(() =>
      expect(achievementsCard().getByText('First Stage')).toBeInTheDocument(),
    );
    expect(
      achievementsCard().queryByText(/sample data/i),
    ).not.toBeInTheDocument();
  });
});
