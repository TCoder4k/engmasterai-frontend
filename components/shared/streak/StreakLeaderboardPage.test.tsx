import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import StreakLeaderboardPage from './StreakLeaderboardPage';
import * as streakService from '../../../services/streakService';
import type { LeaderboardEntry } from '../../../services/streakService';

const USER = { id: 'user-1', name: 'Tu', email: 't@example.com', role: 'USER' };

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const entryOf = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  rank: 1,
  pairId: 'pair-1',
  userA: { id: 'a', name: 'Hoang Long', avatarUrl: null, level: 10 },
  userB: { id: 'b', name: 'Mai Anh', avatarUrl: null, level: 9 },
  currentStreak: 148,
  longestStreak: 148,
  totalXp: 14820,
  isCurrentUserPair: false,
  ...overrides,
});

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/streaks/leaderboard']}>
          <Routes>
            <Route path="/streaks/leaderboard" element={<StreakLeaderboardPage />} />
            <Route path="/streaks/:id" element={<p>streak detail page</p>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify(USER));
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

describe('StreakLeaderboardPage', () => {
  it('renders the champion badge and flame tier for the #1 pair, without any invented tagline or motto', async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([entryOf()]);
    renderPage();

    expect(await screen.findByText(/hoang long & mai anh/i)).toBeInTheDocument();
    expect(screen.getByText(/legendary champion/i)).toBeInTheDocument();
    expect(screen.getByText(/eternal flame dragon/i)).toBeInTheDocument();
    // Nothing resembling the mockup's fabricated per-pair copy is rendered.
    expect(screen.queryByText(/ngoại thương/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ielts/i)).not.toBeInTheDocument();
  });

  it("does not let the viewer click into a STRANGER's champion card either — the backend 403s a non-participant", async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([entryOf({ isCurrentUserPair: false })]);
    renderPage();

    const name = await screen.findByText(/hoang long & mai anh/i);
    expect(name.closest('button')).not.toBeInTheDocument();
  });

  it('DOES let the viewer click into their own champion card', async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([
      entryOf({ pairId: 'pair-own', isCurrentUserPair: true }),
    ]);
    renderPage();

    const name = await screen.findByText(/hoang long & mai anh/i);
    expect(name.closest('button')).toBeInTheDocument();
  });

  // A plain <div> is block-level and fills its podium column by default;
  // <button> defaults to display:inline-block and shrinks to its content
  // instead. Only the viewer's own card ever swaps to <button>, so a
  // missing width override here would visibly shrink ONLY that one card —
  // exactly the bug reported: fine normally, broken only when "your own
  // pair" is on the podium.
  it("renders the viewer's own podium card at full width, not shrunk to its content", async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([
      entryOf({ pairId: 'pair-own', isCurrentUserPair: true }),
    ]);
    renderPage();

    const card = (await screen.findByText(/hoang long & mai anh/i)).closest('button')!;
    expect(card.className).toMatch(/\bw-full\b/);
  });

  it('shows the lower flame tiers for shorter streaks in the #4+ list', async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([
      entryOf({ rank: 1, pairId: 'p1', currentStreak: 148 }),
      entryOf({ rank: 2, pairId: 'p2', currentStreak: 120, userA: { id: 'c', name: 'Minh', avatarUrl: null, level: 5 } }),
      entryOf({ rank: 3, pairId: 'p3', currentStreak: 95, userA: { id: 'd', name: 'Gia Bao', avatarUrl: null, level: 5 } }),
      entryOf({ rank: 4, pairId: 'p4', currentStreak: 5, userA: { id: 'e', name: 'Tuan Kiet', avatarUrl: null, level: 5 } }),
    ]);
    renderPage();

    await screen.findByText(/tuan kiet/i);
    expect(screen.getByText(/little spark/i)).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
    expect(screen.getByText(/14820 XP/)).toBeInTheDocument();
  });

  it('does not render a cheer button or a duo-quiz join affordance', async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([entryOf()]);
    renderPage();

    await screen.findByText(/hoang long & mai anh/i);
    expect(screen.queryByRole('button', { name: /cheer|cổ vũ/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/quiz|đố vui/i)).not.toBeInTheDocument();
  });

  it("highlights the viewer's own pair", async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([
      entryOf({ isCurrentUserPair: true }),
    ]);
    renderPage();

    const card = (await screen.findByText(/hoang long & mai anh/i)).closest('button')!;
    expect(within(card).getByText(/your pair/i)).toBeInTheDocument();
  });

  it("navigates to the streak detail page when the viewer's OWN card is clicked", async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([
      entryOf({ pairId: 'pair-42', isCurrentUserPair: true }),
    ]);
    renderPage();

    const card = (await screen.findByText(/hoang long & mai anh/i)).closest('button')!;
    card.click();

    expect(await screen.findByText('streak detail page')).toBeInTheDocument();
  });

  // The backend 403s a non-participant reading another pair's streak
  // detail, so a stranger's card must not even offer to navigate there.
  it("does not let the viewer click into a STRANGER's pair", async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([
      entryOf({ pairId: 'pair-42', isCurrentUserPair: false }),
    ]);
    renderPage();

    const name = await screen.findByText(/hoang long & mai anh/i);
    expect(name.closest('button')).not.toBeInTheDocument();
  });

  it('shows an empty state when no pair has ever qualified', async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no streaks have made the leaderboard yet/i)).toBeInTheDocument();
  });

  it('shows an error state when the leaderboard fails to load', async () => {
    vi.spyOn(streakService, 'getStreakLeaderboard').mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
