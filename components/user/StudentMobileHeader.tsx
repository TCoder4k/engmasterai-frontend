import React, { useState } from 'react';
import { GraduationCap, Search, X } from 'lucide-react';
import AvatarMenu, { AvatarMenuUser } from '../shared/AvatarMenu';
import ThemeToggle from '../shared/ThemeToggle';
import LanguageSwitcher from '../shared/LanguageSwitcher';
import NotificationBell from '../shared/NotificationBell';
import { useTranslation } from '../../i18n/useTranslation';

interface StudentMobileHeaderProps {
  // Present only on pages with a search feature (the dashboard); when
  // omitted, the search toggle is not rendered at all.
  search?: { value: string; onChange: (value: string) => void };
  user: AvatarMenuUser;
  onLogout: () => void;
  onAvatarUpdate: (newAvatarUrl: string) => void;
}

// Compact phone/tablet header (hidden on lg+, where the desktop header and
// sidebar take over). Search lives behind a toggle that expands into its own
// full-width row, so the input never compresses the control cluster.
const StudentMobileHeader: React.FC<StudentMobileHeaderProps> = ({
  search,
  user,
  onLogout,
  onAvatarUpdate,
}) => {
  const { t } = useTranslation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between px-3 sm:px-4 h-16 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <GraduationCap size={26} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-base font-extrabold text-slate-900 dark:text-white hidden sm:block">
            EngMasterAI
          </span>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-1.5">
          {search && (
            <button
              type="button"
              onClick={() => setIsSearchOpen((open) => !open)}
              aria-expanded={isSearchOpen}
              aria-label={isSearchOpen ? t.header.closeSearch : t.header.openSearch}
              title={isSearchOpen ? t.header.closeSearch : t.header.openSearch}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {isSearchOpen ? <X size={19} aria-hidden="true" /> : <Search size={19} aria-hidden="true" />}
            </button>
          )}
          <ThemeToggle />
          <LanguageSwitcher />
          <NotificationBell />
          <AvatarMenu user={user} onLogout={onLogout} onAvatarUpdate={onAvatarUpdate} />
        </div>
      </div>

      {search && isSearchOpen && (
        <div className="px-3 sm:px-4 pb-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600"
            />
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={t.header.searchPlaceholder}
              aria-label={t.header.searchPlaceholder}
              autoFocus
              className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
            />
          </div>
        </div>
      )}
    </header>
  );
};

export default StudentMobileHeader;
