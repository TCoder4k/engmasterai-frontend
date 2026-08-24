import React from 'react';
import { Flame, Heart, PartyPopper, Trophy } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import EmptyState from '../EmptyState';
import Skeleton from '../Skeleton';
import type { AppNotification } from '../../../services/notificationService';

interface NotificationDropdownProps {
  loadState: 'loading' | 'ready' | 'error';
  notifications: AppNotification[];
  onNotificationClick: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
}

const iconFor = (type: AppNotification['type']) => {
  switch (type) {
    case 'STREAK_MILESTONE':
      return <Trophy size={16} className="text-amber-500" aria-hidden="true" />;
    case 'STREAK_INVITATION_ACCEPTED':
      return <Heart size={16} className="text-rose-500" aria-hidden="true" />;
    case 'STREAK_BROKEN':
      return <Flame size={16} className="text-slate-400" aria-hidden="true" />;
    case 'STREAK_INVITATION_RECEIVED':
      return <PartyPopper size={16} className="text-violet-500" aria-hidden="true" />;
    default:
      return <Flame size={16} className="text-orange-500" aria-hidden="true" />;
  }
};

const messageFor = (
  t: ReturnType<typeof useTranslation>['t'],
  notification: AppNotification,
): string => {
  const name = notification.payload.partnerName ?? '';
  switch (notification.type) {
    case 'STREAK_INVITATION_RECEIVED':
      return t.notifications.invitationReceived(name);
    case 'STREAK_INVITATION_ACCEPTED':
      return t.notifications.invitationAccepted(name);
    case 'STREAK_MILESTONE':
      return t.notifications.milestone(name, notification.payload.days ?? 0);
    case 'STREAK_BROKEN':
      return t.notifications.broken(name);
    case 'STREAK_PARTNER_ACTIVE':
      return t.notifications.partnerActive(name);
    default:
      return '';
  }
};

const formatWhen = (iso: string, locale: string): string => {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const diffMinutes = Math.round((then - Date.now()) / 60000);
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(Math.round(diffHours / 24), 'day');
  } catch {
    return '';
  }
};

// The dropdown content for the now-real NotificationBell — first real
// notification UI in this app (NotificationBell.tsx used to be an honest
// disabled placeholder). REST/poll only, no push channel, per the approved
// scope.
const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  loadState,
  notifications,
  onNotificationClick,
  onMarkAllRead,
}) => {
  const { t, language } = useTranslation();
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="w-full max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.notifications.title}</h3>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
          >
            {t.notifications.markAllRead}
          </button>
        )}
      </div>

      {loadState === 'loading' && (
        <div className="p-4 space-y-2" aria-hidden="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {loadState === 'ready' && notifications.length === 0 && (
        <div className="p-4">
          <EmptyState icon={<Flame size={24} />} message={t.notifications.empty} />
        </div>
      )}

      {loadState === 'ready' && notifications.length > 0 && (
        <ul>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => onNotificationClick(notification)}
                className={`w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 ${
                  notification.read ? '' : 'bg-orange-50/60 dark:bg-orange-500/5'
                }`}
              >
                <span className="mt-0.5 shrink-0">{iconFor(notification.type)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-slate-700 dark:text-slate-200 leading-snug">
                    {messageFor(t, notification)}
                  </span>
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatWhen(notification.createdAt, language)}
                  </span>
                </span>
                {!notification.read && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationDropdown;
