import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import MyStreaksPage from './MyStreaksPage';
import * as streakService from '../../../services/streakService';
import type { StreakPair, StreakInvitation } from '../../../services/streakService';

const USER = { id: 'user-1', name: 'Tu', email: 't@example.com', role: 'USER' };

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const streakOf = (overrides: Partial<StreakPair> = {}): StreakPair => ({
  id: 'pair-1',
  partner: { id: 'p1', name: 'An Tay', avatarUrl: null, level: 5 },
  status: 'ACTIVE',
  currentStreak: 5,
  longestStreak: 5,
  startedAt: '2026-08-01T00:00:00.000Z',
  publicShareId: null,
  ...overrides,
});

const invitationOf = (overrides: Partial<StreakInvitation> = {}): StreakInvitation => ({
  id: 'inv-1',
  direction: 'received',
  counterpart: { id: 'p2', name: 'Thanh', avatarUrl: null, level: 3 },
  status: 'PENDING',
  createdAt: '2026-08-20T00:00:00.000Z',
  expiresAt: '2026-08-27T00:00:00.000Z',
  ...overrides,
});

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/streaks']}>
          <Routes>
            <Route path="/streaks" element={<MyStreaksPage />} />
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
  vi.spyOn(streakService, 'getMyInviteLink').mockResolvedValue({ token: 'ABCD1234' });
  vi.spyOn(streakService, 'listStreakInvitations').mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MyStreaksPage — create-link card', () => {
  it('renders my invite link, built from the origin and the token, once it loads', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByDisplayValue(/\/invite\/ABCD1234$/)).toBeInTheDocument();
  });

  it('copies the invite link when "Copy link" is clicked', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([]);
    // userEvent.setup() must run BEFORE the clipboard override below — it
    // installs its own navigator.clipboard stub (for its copy()/paste()
    // helpers), which otherwise clobbers a mock defined before it. Same
    // order ShareStreakModal.test.tsx's proven mockClipboard() call uses.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage();

    await screen.findByDisplayValue(/\/invite\/ABCD1234$/);
    await user.click(screen.getByRole('button', { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/invite/ABCD1234'));
  });

  it('shows a load-error message, not a broken/blank card, when fetching the link fails', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([]);
    vi.spyOn(streakService, 'getMyInviteLink').mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText(/couldn.t load your invite link/i)).toBeInTheDocument();
  });
});

describe('MyStreaksPage — join-link card', () => {
  it('always shows the static "join a friend\'s streak" placeholder', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/when you click an invite link/i)).toBeInTheDocument();
  });
});

describe('MyStreaksPage — streak list', () => {
  it('shows an empty state when the viewer has no streaks', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no streaks yet/i)).toBeInTheDocument();
  });

  it('renders each streak with its partner name, day count, and an active/broken status label', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([
      streakOf({
        id: 'pair-1',
        partner: { id: 'p1', name: 'An Tay', avatarUrl: null, level: 5 },
        currentStreak: 5,
        status: 'ACTIVE',
      }),
      streakOf({
        id: 'pair-2',
        partner: { id: 'p2', name: 'Thanh', avatarUrl: null, level: 3 },
        currentStreak: 0,
        status: 'BROKEN',
      }),
    ]);
    renderPage();

    expect(await screen.findByText('An Tay')).toBeInTheDocument();
    expect(screen.getByText('Thanh')).toBeInTheDocument();
    expect(screen.getByText(/streak is active/i)).toBeInTheDocument();
    expect(screen.getByText(/this streak has ended/i)).toBeInTheDocument();
  });

  it('navigates to the streak detail page when a streak row is clicked', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([streakOf({ id: 'pair-42' })]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText('An Tay'));

    expect(await screen.findByText('streak detail page')).toBeInTheDocument();
  });

  it('shows an error state when the streak list fails to load', async () => {
    // handleAuthError surfaces the real thrown message when there is one
    // (see services/apiError.ts) — the generic t.streak.loadError fallback
    // only applies when the error carries none.
    vi.spyOn(streakService, 'listMyStreaks').mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});

describe('MyStreaksPage — pending invitations (targeted Community Chat invites)', () => {
  it('shows pending invitations above the streak list, with a working decline', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([]);
    vi.spyOn(streakService, 'listStreakInvitations').mockResolvedValue([invitationOf()]);
    vi.spyOn(streakService, 'declineStreakInvitation').mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/thanh wants to keep a streak/i)).toBeInTheDocument();
    await user.click(screen.getByText('Decline'));

    await waitFor(() => expect(streakService.declineStreakInvitation).toHaveBeenCalledWith('inv-1'));
  });

  it('accepting navigates straight to the new streak detail page', async () => {
    vi.spyOn(streakService, 'listMyStreaks').mockResolvedValue([]);
    vi.spyOn(streakService, 'listStreakInvitations').mockResolvedValue([invitationOf()]);
    vi.spyOn(streakService, 'acceptStreakInvitation').mockResolvedValue(streakOf({ id: 'pair-99' }));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText('Accept'));

    expect(await screen.findByText('streak detail page')).toBeInTheDocument();
  });
});
