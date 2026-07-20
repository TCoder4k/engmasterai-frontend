import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, BookMarked, Headphones, User as UserIcon } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// Fixed native-app-style bottom navigation for phones/tablets (hidden on lg+).
// Items without a real destination are visibly disabled with a "Soon" badge —
// never dead links. NavLink supplies aria-current="page" on the active route.
const StudentBottomNavigation: React.FC = () => {
  const { t } = useTranslation();

  const items: {
    label: string;
    icon: React.ReactNode;
    to?: string;
    end?: boolean;
  }[] = [
    { label: t.nav.home, icon: <Home size={21} />, to: '/home', end: true },
    { label: t.nav.courses, icon: <BookOpen size={21} />, to: '/courses' },
    { label: t.nav.vocabulary, icon: <BookMarked size={21} />, to: '/vocab' },
    { label: t.nav.practice, icon: <Headphones size={21} /> },
    { label: t.nav.profile, icon: <UserIcon size={21} />, to: '/profile' },
  ];

  return (
    <nav
      aria-label={t.nav.bottomNavigation}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-100 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex">
        {items.map((item) =>
          item.to ? (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center space-y-1 py-2.5 min-h-[56px] text-[10px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative" aria-hidden="true">
                    {item.icon}
                    {isActive && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    )}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ) : (
            <div
              key={item.label}
              aria-disabled="true"
              className="flex-1 flex flex-col items-center justify-center space-y-1 py-2.5 min-h-[56px] text-[10px] font-bold text-slate-300 dark:text-slate-700 cursor-not-allowed select-none"
            >
              <span className="relative" aria-hidden="true">
                {item.icon}
                <span className="absolute -top-1.5 -right-3 text-[7px] font-bold uppercase bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 px-1 py-px rounded">
                  {t.common.soon}
                </span>
              </span>
              <span>
                {item.label} <span className="sr-only">({t.common.comingSoon})</span>
              </span>
            </div>
          ),
        )}
      </div>
    </nav>
  );
};

export default StudentBottomNavigation;
