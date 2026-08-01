import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import GamificationBoundary, {
  XP_TOAST_DURATION_MS,
} from '../shared/GamificationProvider';
import * as gamificationService from '../../services/gamificationService';
import {
  GamificationResult,
  publishGamificationResult,
} from '../../services/gamificationService';

// Sprint 10 QA — the XP toast, driven end to end from the service publisher.
//
// Rendered by GamificationProvider rather than by any stage, so it is tested
// through the provider: what matters is not that the markup is right in
// isolation but that ONE timer governs it, that it is cleared, and that a
// replay worth nothing never produces one at all.
//
// Fake timers throughout. A real 1-second wait in a test suite is a second
// nobody gets back, and it would pass just as happily against 4000 ms.

const award = (overrides: Partial<GamificationResult> = {}): GamificationResult => ({
  xpAwarded: 30,
  xp: { totalXp: 1270, level: 6, intoLevel: 270, toNextLevel: 80, percent: 77 },
  leveledUp: false,
  unlockedAchievements: [],
  ...overrides,
});

const renderProvider = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/first']}>
        <Routes>
          <Route element={<GamificationBoundary />}>
            <Route path="/first" element={<p>page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

const publish = (result: GamificationResult) =>
  act(() => {
    publishGamificationResult(result);
  });

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const toast = () => screen.queryByRole('status');

beforeEach(() => {
  vi.useFakeTimers();
  // The profile fetch is irrelevant here and must not resolve into an
  // unawaited act() — a rejection is the cheapest way to settle it, and the
  // toast path is deliberately independent of whether it succeeded.
  vi.spyOn(gamificationService, 'getGamificationProfile').mockRejectedValue(
    new Error('not under test'),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('XpToast', () => {
  it('announces the award and closes after exactly 1000 ms', () => {
    expect(XP_TOAST_DURATION_MS).toBe(1000);

    renderProvider();
    publish(award());

    expect(toast()).toHaveTextContent('+30 XP');

    // One millisecond short: still up. This is the half that catches a
    // duration quietly growing back.
    advance(XP_TOAST_DURATION_MS - 1);
    expect(toast()).toBeInTheDocument();

    advance(1);
    expect(toast()).not.toBeInTheDocument();
  });

  it('shows NO toast for a replay worth nothing', () => {
    // The server distinguishes a replay from a fresh award precisely so this
    // can be true. A retried submit must not re-announce XP granted once.
    renderProvider();
    publish(
      award({
        xpAwarded: 0,
        xp: {
          totalXp: 1240,
          level: 6,
          intoLevel: 240,
          toNextLevel: 110,
          percent: 68,
        },
      }),
    );

    expect(toast()).not.toBeInTheDocument();
    advance(XP_TOAST_DURATION_MS);
    expect(toast()).not.toBeInTheDocument();
  });

  it('names the new level on a level-up', () => {
    renderProvider();
    publish(
      award({
        leveledUp: true,
        xp: {
          totalXp: 1370,
          level: 7,
          intoLevel: 20,
          toNextLevel: 380,
          percent: 5,
        },
      }),
    );

    expect(toast()).toHaveTextContent('Level 7');
  });

  it('closes on the dismiss button, before the timer fires', () => {
    renderProvider();
    publish(award());

    act(() => {
      screen.getByRole('button', { name: /dismiss/i }).click();
    });
    expect(toast()).not.toBeInTheDocument();

    // And the pending timer finding nothing to close must not throw or
    // resurrect anything.
    advance(XP_TOAST_DURATION_MS);
    expect(toast()).not.toBeInTheDocument();
  });

  it('replaces a toast still on screen and restarts its window', () => {
    // Single slot, replace-on-new. A second award must not be swallowed by the
    // first one's timer — which is what would happen if the effect did not
    // re-run on the award changing.
    renderProvider();
    publish(award());
    advance(800);

    publish(award({ xpAwarded: 5 }));
    expect(toast()).toHaveTextContent('+5 XP');

    // 800 + 400 is past the FIRST toast's deadline; the replacement gets its
    // own full window.
    advance(400);
    expect(toast()).toHaveTextContent('+5 XP');

    advance(600);
    expect(toast()).not.toBeInTheDocument();
  });

  it('leaves no timer behind on unmount', () => {
    const { unmount } = renderProvider();
    publish(award());
    expect(toast()).toBeInTheDocument();

    unmount();
    // A surviving setTimeout would call setAward on an unmounted tree.
    expect(vi.getTimerCount()).toBe(0);
  });
});
