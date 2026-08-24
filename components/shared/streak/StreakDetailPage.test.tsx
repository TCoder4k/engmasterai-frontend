import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import StreakDetailPage from './StreakDetailPage';
import * as streakService from '../../../services/streakService';
import * as feedbackSounds from '../../../services/feedbackSounds';
import type { StreakDetail } from '../../../services/streakService';

const USER = { id: 'user-1', name: 'Tu', email: 't@example.com', role: 'USER' };

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const detailOf = (overrides: Partial<StreakDetail> = {}): StreakDetail => ({
  id: 'streak-1',
  partner: { id: 'other-1', name: 'Anna', avatarUrl: null, level: 5 },
  status: 'ACTIVE',
  currentStreak: 7,
  longestStreak: 7,
  startedAt: '2026-08-01T00:00:00.000Z',
  publicShareId: null,
  calendar: [],
  isAtRiskToday: false,
  meActivityToday: { qualified: true, label: 'lesson', at: '2026-08-24T08:00:00.000Z' },
  partnerActivityToday: { qualified: true, label: 'practice', at: '2026-08-24T09:00:00.000Z' },
  percentileRank: 8,
  ...overrides,
});

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/streaks/streak-1']}>
          <Routes>
            <Route path="/streaks/:id" element={<StreakDetailPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify(USER));
  // NotificationBell (rendered inside StudentLayout) fetches on mount —
  // a plain 404 fallback matches the convention used by the other
  // StudentLayout-rendering page tests (e.g. CourseDetailPage.test.tsx).
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(404, { message: 'Not found' }))),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('StreakDetailPage — milestone celebration', () => {
  it('celebrates a newly crossed milestone exactly once and remembers it', async () => {
    vi.spyOn(streakService, 'getStreakDetail').mockResolvedValue(detailOf({ currentStreak: 7 }));
    const soundSpy = vi.spyOn(feedbackSounds, 'playMilestone').mockImplementation(() => {});
    const whooshSpy = vi.spyOn(feedbackSounds, 'playFlameWhoosh').mockImplementation(() => {});
    renderPage();

    expect(await screen.findByRole('dialog', { name: /7-day streak/i })).toBeInTheDocument();
    expect(screen.getByText(/kept it going for 7 days straight/i)).toBeInTheDocument();
    // Both fire from the same mount effect (whoosh synchronously, the
    // fanfare after a 150ms setTimeout) — wait on the later one first so a
    // slow commit under full-suite parallel load can't make the earlier,
    // synchronous assertion flake.
    await waitFor(() => expect(soundSpy).toHaveBeenCalledTimes(1));
    expect(whooshSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('engmasterai:streakMilestoneSeen:streak-1')).toBe('7');
  });

  it('celebrates day 1 — the very first day a streak is mutually qualified', async () => {
    vi.spyOn(streakService, 'getStreakDetail').mockResolvedValue(
      detailOf({ currentStreak: 1, longestStreak: 1 }),
    );
    vi.spyOn(feedbackSounds, 'playMilestone').mockImplementation(() => {});
    vi.spyOn(feedbackSounds, 'playFlameWhoosh').mockImplementation(() => {});
    renderPage();

    expect(await screen.findByRole('dialog', { name: /1-day streak/i })).toBeInTheDocument();
  });

  it('closing the milestone modal dismisses it without re-showing it', async () => {
    vi.spyOn(streakService, 'getStreakDetail').mockResolvedValue(detailOf({ currentStreak: 7 }));
    vi.spyOn(feedbackSounds, 'playMilestone').mockImplementation(() => {});
    vi.spyOn(feedbackSounds, 'playFlameWhoosh').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPage();

    const dialog = await screen.findByRole('dialog', { name: /7-day streak/i });
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(dialog).not.toBeInTheDocument();
  });

  it('does not re-celebrate a milestone already seen on this device', async () => {
    localStorage.setItem('engmasterai:streakMilestoneSeen:streak-1', '7');
    vi.spyOn(streakService, 'getStreakDetail').mockResolvedValue(detailOf({ currentStreak: 7 }));
    const soundSpy = vi.spyOn(feedbackSounds, 'playMilestone').mockImplementation(() => {});
    renderPage();

    await screen.findAllByText(/7 days/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(soundSpy).not.toHaveBeenCalled();
  });

  it('does not celebrate when the current streak is not a milestone day', async () => {
    // 0 is below the lowest milestone (1), so nothing has ever been crossed.
    vi.spyOn(streakService, 'getStreakDetail').mockResolvedValue(
      detailOf({ currentStreak: 0, longestStreak: 2 }),
    );
    const soundSpy = vi.spyOn(feedbackSounds, 'playMilestone').mockImplementation(() => {});
    renderPage();

    await screen.findAllByText(/0 days/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(soundSpy).not.toHaveBeenCalled();
  });

  it('celebrates the highest milestone already passed, not every one skipped over', async () => {
    // e.g. reopening the page for the first time after jumping from day 6 to
    // day 10 — only 7 was ever crossed and unseen; 10 itself isn't a
    // milestone, so 7 is what gets celebrated, not silence and not 10.
    vi.spyOn(streakService, 'getStreakDetail').mockResolvedValue(detailOf({ currentStreak: 10 }));
    vi.spyOn(feedbackSounds, 'playMilestone').mockImplementation(() => {});
    vi.spyOn(feedbackSounds, 'playFlameWhoosh').mockImplementation(() => {});
    renderPage();

    expect(await screen.findByRole('dialog', { name: /7-day streak/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem('engmasterai:streakMilestoneSeen:streak-1')).toBe('7'),
    );
  });
});
