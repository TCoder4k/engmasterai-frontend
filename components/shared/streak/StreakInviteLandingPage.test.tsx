import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import StreakInviteLandingPage from './StreakInviteLandingPage';
import * as streakService from '../../../services/streakService';
import { ApiError } from '../../../services/apiError';

const renderAt = (path: string) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/invite/:token" element={<StreakInviteLandingPage />} />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/register" element={<p>register page</p>} />
          <Route path="/streaks/:id" element={<p>streak detail page</p>} />
          <Route path="/streaks" element={<p>my streaks page</p>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

const pairOf = () => ({
  id: 'pair-99',
  partner: { id: 'p1', name: 'An Tay', avatarUrl: null, level: 5 },
  status: 'ACTIVE' as const,
  currentStreak: 1,
  longestStreak: 1,
  startedAt: '2026-08-24T00:00:00.000Z',
  publicShareId: null,
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StreakInviteLandingPage — not authenticated', () => {
  it('shows the inviter preview and login/register links carrying a return-to state', async () => {
    vi.spyOn(streakService, 'getInviteLinkPreview').mockResolvedValue({
      inviterName: 'An Tay',
      inviterAvatarUrl: null,
    });
    renderAt('/invite/ABCD1234');

    expect(await screen.findByText(/an tay invites you/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    // No join affordance is offered before the visitor is authenticated.
    expect(screen.queryByRole('button', { name: /join streak/i })).not.toBeInTheDocument();
  });
});

describe('StreakInviteLandingPage — invalid or unknown token', () => {
  it('shows a not-found message instead of crashing or hanging', async () => {
    vi.spyOn(streakService, 'getInviteLinkPreview').mockRejectedValue(new Error('not found'));
    renderAt('/invite/does-not-exist');

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
  });
});

describe('StreakInviteLandingPage — authenticated', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'token');
  });

  it('shows a join button and navigates to the new pair on success', async () => {
    vi.spyOn(streakService, 'getInviteLinkPreview').mockResolvedValue({
      inviterName: 'An Tay',
      inviterAvatarUrl: null,
    });
    vi.spyOn(streakService, 'acceptInviteLink').mockResolvedValue(pairOf());
    const user = userEvent.setup();
    renderAt('/invite/ABCD1234');

    await user.click(await screen.findByRole('button', { name: /join streak/i }));

    expect(await screen.findByText('streak detail page')).toBeInTheDocument();
  });

  it('shows an "own link" message instead of an error when the backend rejects a self-join', async () => {
    vi.spyOn(streakService, 'getInviteLinkPreview').mockResolvedValue({
      inviterName: 'Tu',
      inviterAvatarUrl: null,
    });
    vi.spyOn(streakService, 'acceptInviteLink').mockRejectedValue(new ApiError('bad request', 400));
    const user = userEvent.setup();
    renderAt('/invite/ABCD1234');

    await user.click(await screen.findByRole('button', { name: /join streak/i }));

    expect(await screen.findByText(/this is your own invite link/i)).toBeInTheDocument();
  });

  it('shows a retryable error message on an unexpected failure', async () => {
    vi.spyOn(streakService, 'getInviteLinkPreview').mockResolvedValue({
      inviterName: 'An Tay',
      inviterAvatarUrl: null,
    });
    vi.spyOn(streakService, 'acceptInviteLink').mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderAt('/invite/ABCD1234');

    await user.click(await screen.findByRole('button', { name: /join streak/i }));

    expect(await screen.findByText(/couldn.t join this streak/i)).toBeInTheDocument();
  });
});
