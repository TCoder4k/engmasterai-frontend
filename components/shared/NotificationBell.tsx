import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../services/notificationService';
import NotificationDropdown from './streak/NotificationDropdown';

const POLL_INTERVAL_MS = 60_000;

type LoadState = 'loading' | 'ready' | 'error';

// Streak Together — the first real notification system in this app
// (previously an honest disabled placeholder: "no notifications backend,
// so no unread badge is fabricated"). REST/poll only, no push channel — the
// unread count refreshes on mount and every 60s, matching the "minimal"
// scope decision.
const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const refreshUnreadCount = useCallback(() => {
    getUnreadNotificationCount()
      .then(setUnreadCount)
      .catch(() => {
        // Best-effort — a failed poll just leaves the last known count.
      });
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!isOpen) return;
    setLoadState('loading');
    listNotifications()
      .then((result) => {
        setNotifications(result.data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: AppNotification) => {
    setIsOpen(false);
    if (!notification.read) {
      setUnreadCount((count) => Math.max(0, count - 1));
      void markNotificationRead(notification.id);
    }
    if (notification.payload.streakId) {
      navigate(`/streaks/${notification.payload.streakId}`);
    } else if (notification.type === 'STREAK_INVITATION_RECEIVED') {
      navigate('/streaks');
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead();
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t.header.notifications}
        title={t.header.notifications}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="fixed inset-x-3 top-16 lg:absolute lg:inset-x-auto lg:top-auto lg:right-0 lg:mt-2 lg:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50"
        >
          <NotificationDropdown
            loadState={loadState}
            notifications={notifications}
            onNotificationClick={handleNotificationClick}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
