import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import NotificationBell from './NotificationBell';
import * as notificationService from '../../services/notificationService';
import type { AppNotification } from '../../services/notificationService';

const renderBell = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<NotificationBell />} />
          <Route path="/streaks/:id" element={<p>streak detail page</p>} />
          <Route path="/streaks" element={<p>my streaks page</p>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

const makeNotification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  type: 'STREAK_MILESTONE',
  payload: { partnerName: 'Anna', days: 7, streakId: 'streak-1' },
  read: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NotificationBell', () => {
  it('shows the unread count as a badge', async () => {
    vi.spyOn(notificationService, 'getUnreadNotificationCount').mockResolvedValue(3);
    renderBell();

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('shows no badge when there are no unread notifications', async () => {
    vi.spyOn(notificationService, 'getUnreadNotificationCount').mockResolvedValue(0);
    renderBell();

    await waitFor(() => expect(notificationService.getUnreadNotificationCount).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('opens the dropdown and lists notifications on click', async () => {
    vi.spyOn(notificationService, 'getUnreadNotificationCount').mockResolvedValue(1);
    vi.spyOn(notificationService, 'listNotifications').mockResolvedValue({
      data: [makeNotification()],
      meta: { hasMore: false, oldestId: null },
    });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText(/reached 7 days together/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no notifications', async () => {
    vi.spyOn(notificationService, 'getUnreadNotificationCount').mockResolvedValue(0);
    vi.spyOn(notificationService, 'listNotifications').mockResolvedValue({
      data: [],
      meta: { hasMore: false, oldestId: null },
    });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it('clicking a notification marks it read and navigates to its streak', async () => {
    vi.spyOn(notificationService, 'getUnreadNotificationCount').mockResolvedValue(1);
    vi.spyOn(notificationService, 'listNotifications').mockResolvedValue({
      data: [makeNotification()],
      meta: { hasMore: false, oldestId: null },
    });
    const markReadSpy = vi.spyOn(notificationService, 'markNotificationRead').mockResolvedValue();
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByText(/reached 7 days together/i));

    expect(markReadSpy).toHaveBeenCalledWith('n1');
    expect(await screen.findByText('streak detail page')).toBeInTheDocument();
  });

  it('mark-all-read clears the unread badge', async () => {
    vi.spyOn(notificationService, 'getUnreadNotificationCount').mockResolvedValue(2);
    vi.spyOn(notificationService, 'listNotifications').mockResolvedValue({
      data: [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' })],
      meta: { hasMore: false, oldestId: null },
    });
    vi.spyOn(notificationService, 'markAllNotificationsRead').mockResolvedValue();
    const user = userEvent.setup();
    renderBell();

    expect(await screen.findByText('2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByRole('button', { name: /mark all as read/i }));

    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});
