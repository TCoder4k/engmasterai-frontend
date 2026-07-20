import React from 'react';
import { Bell } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// Honest placeholder — there is no notifications backend, so no unread badge
// is fabricated and the control announces itself as coming soon.
const NotificationBell: React.FC = () => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      aria-label={t.header.notifications}
      title={t.header.notifications}
      aria-disabled="true"
      className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-500 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <Bell size={19} aria-hidden="true" />
    </button>
  );
};

export default NotificationBell;
