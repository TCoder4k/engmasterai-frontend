import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import AvatarMenu from '../shared/AvatarMenu';
import ThemeToggle from '../shared/ThemeToggle';
import LanguageSwitcher from '../shared/LanguageSwitcher';
import NotificationBell from '../shared/NotificationBell';
import StudentDesktopSidebar from './StudentDesktopSidebar';
import StudentMobileHeader from './StudentMobileHeader';
import StudentBottomNavigation from './StudentBottomNavigation';
import { authService } from '../../services/authService';
import { useTranslation } from '../../i18n/useTranslation';

interface StudentLayoutProps {
  children: React.ReactNode;
  // Present only on pages with a search feature (the dashboard). Passed
  // through to both the desktop header input and the mobile search toggle.
  search?: { value: string; onChange: (value: string) => void };
}

// The single student page shell: desktop sidebar + desktop header on lg+,
// compact mobile header + fixed bottom navigation below lg. Layout and
// navigation concerns only — pages own their content and data fetching.
// Owns the user/avatar/logout state so pages don't each re-derive it.
const StudentLayout: React.FC<StudentLayoutProps> = ({ children, search }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = authService.getUser();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);

  const handleLogout = async () => {
    const { degraded } = await authService.logout();
    if (degraded) {
      console.warn('Logout: server-side session revocation could not be confirmed.');
    }
    navigate('/login');
  };

  const avatarUser = {
    name: user?.name || 'User',
    avatarUrl: avatarUrl,
    role: (user?.role as 'USER' | 'ADMIN') || 'USER',
  };

  return (
    <div className="min-h-screen flex bg-[#f7f8fb] dark:bg-slate-950">
      <StudentDesktopSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentMobileHeader
          search={search}
          user={avatarUser}
          onLogout={handleLogout}
          onAvatarUpdate={setAvatarUrl}
        />

        {/* Desktop header — search input only where the page provides one;
            the control cluster is always present. */}
        <header className="hidden lg:flex bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-4 items-center justify-between sticky top-0 z-40">
          {search ? (
            <div className="relative flex-1 max-w-xl">
              <Search
                size={17}
                aria-hidden="true"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600"
              />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={t.header.searchPlaceholder}
                aria-label={t.header.searchPlaceholder}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex items-center space-x-2.5 ml-6">
            <ThemeToggle />
            <LanguageSwitcher />
            <NotificationBell />
            <AvatarMenu user={avatarUser} onLogout={handleLogout} onAvatarUpdate={setAvatarUrl} />
          </div>
        </header>

        {/* pb-24 keeps the last content clear of the fixed bottom nav on
            phones/tablets; lg+ has no bottom nav. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>

        <StudentBottomNavigation />
      </div>
    </div>
  );
};

export default StudentLayout;
