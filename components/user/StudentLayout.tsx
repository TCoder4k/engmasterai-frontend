import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarMenu from '../shared/AvatarMenu';
import ThemeToggle from '../shared/ThemeToggle';
import LanguageSwitcher from '../shared/LanguageSwitcher';
import NotificationBell from '../shared/NotificationBell';
import StudentDesktopSidebar from './StudentDesktopSidebar';
import StudentMobileHeader from './StudentMobileHeader';
import StudentBottomNavigation from './StudentBottomNavigation';
import { authService } from '../../services/authService';

interface StudentLayoutProps {
  children: React.ReactNode;
}

// The single student page shell: desktop sidebar + desktop header on lg+,
// compact mobile header + fixed bottom navigation below lg. Layout and
// navigation concerns only — pages own their content and data fetching.
// Owns the user/avatar/logout state so pages don't each re-derive it.
//
// Sprint 05 removed the `search` prop and the header search box. It existed
// for one page (the Dashboard), where it only filtered an already-small
// client-side course grid; the three module entry points on the Dashboard
// replaced it. Nothing took its place in the header.
const StudentLayout: React.FC<StudentLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
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
        <StudentMobileHeader user={avatarUser} onLogout={handleLogout} onAvatarUpdate={setAvatarUrl} />

        {/* Desktop header — the flex-1 spacer keeps the control cluster
            right-aligned now that the search input is gone (Sprint 05). */}
        <header className="hidden lg:flex bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-4 items-center justify-between sticky top-0 z-40">
          <div className="flex-1" />

          {/* No SoundToggle here. It was global chrome on every student page for
              a setting that only affects quiz/practice feedback sounds; the
              toggle that matters stays beside the listening session, where the
              sound actually is. */}
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
