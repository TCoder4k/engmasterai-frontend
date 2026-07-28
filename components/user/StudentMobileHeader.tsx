import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import AvatarMenu, { AvatarMenuUser } from '../shared/AvatarMenu';
import ThemeToggle from '../shared/ThemeToggle';
import SoundToggle from '../shared/SoundToggle';
import LanguageSwitcher from '../shared/LanguageSwitcher';
import NotificationBell from '../shared/NotificationBell';
import { useTranslation } from '../../i18n/useTranslation';

interface StudentMobileHeaderProps {
  user: AvatarMenuUser;
  onLogout: () => void;
  onAvatarUpdate: (newAvatarUrl: string) => void;
}

// Compact phone/tablet header (hidden on lg+, where the desktop header and
// sidebar take over). Sprint 05 removed the search toggle and its expanding
// row along with the Dashboard search box; the control cluster is all that
// remains, and it was never compressed by it.
const StudentMobileHeader: React.FC<StudentMobileHeaderProps> = ({
  user,
  onLogout,
  onAvatarUpdate,
}) => {
  const { t } = useTranslation();

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between px-3 sm:px-4 h-16 gap-2">
        {/* The brand area is a real router link back to the Dashboard
            (Sprint 03E) — same behavior as the desktop sidebar's brand. */}
        <Link
          to="/home"
          aria-label={t.nav.goToDashboard}
          className="flex items-center space-x-2 min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <GraduationCap size={26} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-base font-extrabold text-slate-900 dark:text-white hidden sm:block">
            EngMasterAI
          </span>
        </Link>

        <div className="flex items-center space-x-1 sm:space-x-1.5">
          <SoundToggle />
          <ThemeToggle />
          <LanguageSwitcher />
          <NotificationBell />
          <AvatarMenu user={user} onLogout={onLogout} onAvatarUpdate={onAvatarUpdate} />
        </div>
      </div>
    </header>
  );
};

export default StudentMobileHeader;
