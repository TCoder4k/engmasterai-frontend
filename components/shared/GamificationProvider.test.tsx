import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import GamificationBoundary, { useGamification } from './GamificationProvider';
import * as gamificationService from '../../services/gamificationService';
import {
  GamificationProfile,
  GamificationResult,
  publishGamificationResult,
} from '../../services/gamificationService';

// Sprint 10 — the provider that feeds the level widget.
//
// The two properties worth protecting here are both about REQUEST COUNT and
// about honesty under failure:
//
//   - it must fetch ONCE per session, not once per page, because the widget it
//     feeds is rendered by StudentLayout on every student route;
//   - a failed request must never render as "Level 1 / 0 XP", which on a
//     student at level 6 is a false statement rather than an empty state.
//
// Sprint 10 QA added a third: an award must reconcile the CACHED PROFILE, not
// just the toast. The two subscribe independently, so a bug in the state path
// is invisible — the "+30 XP" still appears while the widget below it keeps
// the numbers it had at sign-in. Everything under `applyOutcome` below exists
// because that shipped.

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
    { key: 'XP_500', xp: 100, unlockedAt: null, progress: { current: 240, target: 500 } },
    { key: 'STREAK_3', xp: 50, unlockedAt: null, progress: null },
  ],
  nextMilestoneDays: 3,
  ...overrides,
});

// +30 XP, still level 6.
const AWARD: GamificationResult = {
  xpAwarded: 30,
  xp: { totalXp: 1270, level: 6, intoLevel: 270, toNextLevel: 80, percent: 77 },
  leveledUp: false,
  unlockedAchievements: ['XP_500'],
};

// The award that crosses into level 7, unlocking two badges at once.
const LEVEL_UP: GamificationResult = {
  xpAwarded: 130,
  xp: { totalXp: 1370, level: 7, intoLevel: 20, toNextLevel: 380, percent: 5 },
  leveledUp: true,
  unlockedAchievements: ['XP_500', 'STREAK_3'],
};

const REPLAY: GamificationResult = {
  xpAwarded: 0,
  xp: { totalXp: 1240, level: 6, intoLevel: 240, toNextLevel: 110, percent: 68 },
  leveledUp: false,
  unlockedAchievements: [],
};

// A probe that renders whatever the provider is currently holding.
const Probe: React.FC<{ label: string }> = ({ label }) => {
  const gamification = useGamification();
  if (!gamification) return <p>no provider</p>;
  const { profile: current, refresh } = gamification;
  return (
    <div>
      <p data-testid={`state-${label}`}>
        {current === undefined
          ? 'loading'
          : current === null
            ? 'failed'
            : `level ${current.xp.level} / ${current.xp.totalXp} xp / ${current.xp.percent}% / ${current.xp.toNextLevel} to go`}
      </p>
      <p data-testid={`unlocked-${label}`}>
        {current
          ? current.achievements
              .filter((a) => a.unlockedAt)
              .map((a) => a.key)
              .join(',')
          : ''}
      </p>
      <button type="button" onClick={refresh}>
        retry
      </button>
      <Link to="/second">go second</Link>
    </div>
  );
};

const renderRoutes = (initial = '/first') =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<GamificationBoundary />}>
            <Route path="/first" element={<Probe label="first" />} />
            <Route path="/second" element={<Probe label="second" />} />
          </Route>
          {/* Outside the boundary — stands in for the admin group. */}
          <Route path="/admin" element={<Probe label="admin" />} />
        </Routes>
      </MemoryRouter>
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

describe('GamificationBoundary', () => {
  it('fetches the profile once and exposes it', async () => {
    renderRoutes();

    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent(
        'level 6 / 1240 xp',
      ),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT refetch when the student navigates to another page', async () => {
    // The whole reason this is a layout route rather than something inside
    // StudentLayout: each page renders its own shell, so a provider in there
    // would remount and refetch on every navigation.
    renderRoutes();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('link', { name: /go second/i }));
    await waitFor(() =>
      expect(screen.getByTestId('state-second')).toHaveTextContent('level 6'),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('issues NO request at all outside the boundary', async () => {
    // Admin routes sit outside by structure, so they cost nothing.
    renderRoutes('/admin');

    await screen.findByText('no provider');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports failure as `failed`, NEVER as level 1 / 0 xp', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    renderRoutes();

    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('failed'),
    );
    expect(screen.getByTestId('state-first')).not.toHaveTextContent('level 1');
    expect(screen.getByTestId('state-first')).not.toHaveTextContent('0 xp');
  });

  it('refetches on retry after a failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    renderRoutes();
    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('failed'),
    );

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent(
        'level 6 / 1240 xp',
      ),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// Published through the real service publisher, not by calling applyOutcome
// directly — the fan-out from the service boundary to the provider is part of
// what has to work, and a probe that calls the context method skips it.
const publish = async (result: GamificationResult) => {
  await act(async () => {
    publishGamificationResult(result);
  });
};

describe('applying an award to the cached profile', () => {
  it('updates the level, the total AND the bar, with no extra request', async () => {
    // The Sprint 10 QA bug in one assertion. The old fold patched totalXp and
    // level only, so `percent` and `toNextLevel` — everything the widget draws
    // below the level number — stayed frozen at their sign-in values until F5.
    renderRoutes();
    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('1240 xp'),
    );

    await publish(AWARD);

    expect(screen.getByTestId('state-first')).toHaveTextContent(
      'level 6 / 1270 xp / 77% / 80 to go',
    );
    // The point: the widget stays right without a round trip, because the
    // write endpoint already returned the new curve.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('moves the level immediately on a level-up', async () => {
    renderRoutes();
    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('1240 xp'),
    );

    await publish(LEVEL_UP);

    // Both halves must move together. The old code flipped the header to
    // "Level 7" while leaving the bar showing level 6's fill.
    expect(screen.getByTestId('state-first')).toHaveTextContent(
      'level 7 / 1370 xp / 5% / 380 to go',
    );
  });

  it('unlocks every achievement reported by a single action', async () => {
    renderRoutes();
    await waitFor(() =>
      expect(screen.getByTestId('unlocked-first')).toHaveTextContent(
        'FIRST_STAGE',
      ),
    );

    await publish(LEVEL_UP);

    expect(screen.getByTestId('unlocked-first')).toHaveTextContent(
      'FIRST_STAGE,XP_500,STREAK_3',
    );
  });

  it('IGNORES a replayed action that awarded nothing', async () => {
    // A retried submit reports xpAwarded: 0. Nothing on screen may move —
    // least of all an achievement lighting up a second time.
    renderRoutes();
    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('1240 xp'),
    );

    await publish(REPLAY);

    expect(screen.getByTestId('state-first')).toHaveTextContent('1240 xp');
    expect(screen.getByTestId('unlocked-first')).toHaveTextContent(
      'FIRST_STAGE',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the SAME award arrives twice', async () => {
    // Every field in the envelope is absolute rather than a delta, which is
    // what makes a duplicated response harmless. If any of it were ever summed
    // client-side this would read 1300.
    renderRoutes();
    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('1240 xp'),
    );

    await publish(AWARD);
    await publish(AWARD);

    expect(screen.getByTestId('state-first')).toHaveTextContent('1270 xp');
  });

  it('DISCARDS a stale award reporting a lower total', async () => {
    // Two writes in flight at once can resolve out of order. The ledger only
    // ever adds, so a total below the one on screen cannot be the newer of the
    // two — applying it would visibly roll the student backwards.
    renderRoutes();
    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('1240 xp'),
    );

    await publish(LEVEL_UP);
    await publish(AWARD); // 1270 — older than the 1370 already applied

    expect(screen.getByTestId('state-first')).toHaveTextContent('1370 xp');
  });
});

describe('awards racing the profile request', () => {
  it('keeps an award published BEFORE the profile arrives', async () => {
    // Reproduces the real race: LessonPage marks theory as started from a
    // mount effect, so on a hard load of a lesson the award and the provider's
    // own GET leave together. The old code dropped the award outright (no
    // cached profile to fold into) while the toast still fired.
    let resolveProfile: (value: GamificationProfile) => void = () => {};
    fetchSpy.mockReturnValueOnce(
      new Promise<GamificationProfile>((resolve) => {
        resolveProfile = resolve;
      }),
    );

    renderRoutes();
    expect(screen.getByTestId('state-first')).toHaveTextContent('loading');

    await publish(AWARD);
    await act(async () => {
      resolveProfile(profile());
    });

    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent(
        'level 6 / 1270 xp / 77% / 80 to go',
      ),
    );
    expect(screen.getByTestId('unlocked-first')).toHaveTextContent('XP_500');
    // Still one request — the queue is folded on top of the payload, not
    // recovered with a refetch.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not let a late profile response roll an award back', async () => {
    // Same race, opposite failure: the in-flight payload was computed BEFORE
    // the award, so applying it last would overwrite the new totals with the
    // old ones.
    let resolveProfile: (value: GamificationProfile) => void = () => {};
    fetchSpy.mockReturnValueOnce(
      new Promise<GamificationProfile>((resolve) => {
        resolveProfile = resolve;
      }),
    );

    renderRoutes();
    await publish(LEVEL_UP);
    await act(async () => {
      resolveProfile(profile()); // the pre-award snapshot: 1240 XP, level 6
    });

    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('1370 xp'),
    );
  });

  it('drops the queue when the profile request FAILS', async () => {
    // There is nothing to fold onto, and assembling a profile out of one
    // action's totals would invent an achievement list nobody reported. The
    // honest answer is the same `failed` state a plain failure produces.
    fetchSpy.mockRejectedValueOnce(new Error('network'));

    renderRoutes();
    await publish(AWARD);

    await waitFor(() =>
      expect(screen.getByTestId('state-first')).toHaveTextContent('failed'),
    );
  });
});
