import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import StreakEntryPopover from './StreakEntryPopover';
import * as streakService from '../../../services/streakService';
import type { PairRelationshipResult } from '../../../services/streakService';
import { ApiError } from '../../../services/apiError';

const renderPopover = (onClose = vi.fn()) =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <StreakEntryPopover userId="other-1" name="Anna" avatarUrl={null} level={5} onClose={onClose} />
      </MemoryRouter>
    </LanguageProvider>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StreakEntryPopover', () => {
  it('offers to invite when there is no existing relationship', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({ relationship: 'none' });
    renderPopover();

    expect(await screen.findByRole('button', { name: /keep a streak together/i })).toBeInTheDocument();
  });

  it('sends an invite through the confirmation step', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({ relationship: 'none' });
    const sendSpy = vi
      .spyOn(streakService, 'sendStreakInvitation')
      .mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderPopover();

    await user.click(await screen.findByRole('button', { name: /keep a streak together/i }));
    expect(screen.getByText(/keep a daily streak with anna/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => expect(sendSpy).toHaveBeenCalledWith('other-1'));
    expect(await screen.findByText(/invite sent/i)).toBeInTheDocument();
  });

  it('auto-closes the popover shortly after the invite is sent', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({ relationship: 'none' });
    vi.spyOn(streakService, 'sendStreakInvitation').mockResolvedValue({} as never);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPopover(onClose);

    await user.click(await screen.findByRole('button', { name: /keep a streak together/i }));
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    await screen.findByText(/invite sent/i);

    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('shows a disabled pending state for an invite the viewer already sent', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({
      relationship: 'pending_sent',
    } as PairRelationshipResult);
    renderPopover();

    const pending = await screen.findByRole('button', { name: /waiting for a response/i });
    expect(pending).toBeDisabled();
  });

  it('offers accept/decline for an invite the viewer received', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({
      relationship: 'pending_received',
      invitation: {
        id: 'inv-1',
        direction: 'received',
        counterpart: { id: 'other-1', name: 'Anna', avatarUrl: null, level: 5 },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
    });
    renderPopover();

    expect(await screen.findByRole('button', { name: /^accept$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument();
  });

  // Regression test for the confirmed 2026-09-09 production bug: the
  // invitation was PENDING-in-status-but-actually-expired, so accepting
  // 410'd. Coverage here is for the CLIENT'S recovery from that — the
  // backend fix itself (getPairStatus no longer reporting a stale
  // invitation as pending_received in the first place) is covered by
  // streak.service.spec.ts, not reachable from this mocked-service test.
  it('shows a clear "expired" message and refreshes the relationship after Accept 410s on a stale invitation', async () => {
    const pendingReceived: PairRelationshipResult = {
      relationship: 'pending_received',
      invitation: {
        id: 'inv-1',
        direction: 'received',
        counterpart: { id: 'other-1', name: 'Anna', avatarUrl: null, level: 5 },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
    };
    const statusSpy = vi
      .spyOn(streakService, 'getStreakPairStatus')
      .mockResolvedValueOnce(pendingReceived)
      // The re-fetch after the 410 — now-fixed getPairStatus correctly
      // reports 'none' for the same, now-recognized-as-stale invitation.
      .mockResolvedValueOnce({ relationship: 'none' });
    vi.spyOn(streakService, 'acceptStreakInvitation').mockRejectedValue(
      new ApiError('Invitation has expired', 410),
    );
    const user = userEvent.setup();
    renderPopover();

    await user.click(await screen.findByRole('button', { name: /^accept$/i }));

    expect(await screen.findByText(/this invitation has expired/i)).toBeInTheDocument();
    await waitFor(() => expect(statusSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /keep a streak together/i })).toBeInTheDocument();
  });

  it('shows the day count for an active streak and navigates on click', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({
      relationship: 'active',
      streak: {
        id: 'streak-1',
        partner: { id: 'other-1', name: 'Anna', avatarUrl: null, level: 5 },
        status: 'ACTIVE',
        currentStreak: 12,
        longestStreak: 12,
        startedAt: new Date().toISOString(),
        publicShareId: null,
      },
    });
    renderPopover();

    expect(await screen.findByRole('button', { name: /12 days with anna/i })).toBeInTheDocument();
  });

  it('offers to restart after a broken streak', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockResolvedValue({
      relationship: 'broken',
      streak: {
        id: 'streak-1',
        partner: { id: 'other-1', name: 'Anna', avatarUrl: null, level: 5 },
        status: 'BROKEN',
        currentStreak: 0,
        longestStreak: 9,
        startedAt: new Date().toISOString(),
        publicShareId: null,
      },
    });
    renderPopover();

    expect(await screen.findByRole('button', { name: /start a new streak/i })).toBeInTheDocument();
  });

  it('shows an error state when the relationship lookup fails', async () => {
    vi.spyOn(streakService, 'getStreakPairStatus').mockRejectedValue(new Error('boom'));
    renderPopover();

    expect(await screen.findByText(/couldn.t load streak status/i)).toBeInTheDocument();
  });
});
