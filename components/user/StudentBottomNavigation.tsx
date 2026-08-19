import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, BookMarked, Headphones, User as UserIcon } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// Fixed native-app-style bottom navigation for phones/tablets (hidden on lg+).
// Items without a real destination are visibly disabled with a "Soon" badge —
// never dead links. NavLink supplies aria-current="page" on the active route.
const StudentBottomNavigation: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // "Nghe - nói" opens /practice — the shared Listening/Shadowing + Speaking
  // Partner mode-selection hub. Realigned from a same-day Sprint 13
  // follow-up that had instead sent this slot straight to /practice/listening
  // and added a SIXTH, separate "Speaking" slot ("no Speaking/Writing item"
  // this file's own history had deliberately avoided) — the product owner's
  // reference design puts both modes behind ONE nav item, chosen at
  // /practice, so that sixth slot is gone and this file is back to five.
  //
  // Because the target is now /practice itself, NavLink's own `to`-based
  // matching would need to cover /practice AND every mode nested under it
  // (listening, shadowing, speaking) while EXCLUDING /practice/vocab and
  // /practice/review, which share the prefix but belong to a different
  // section — more than a single `to` match can express, and NavLink's
  // `aria-current` can't be overridden by a passed prop (confirmed against
  // react-router's own NavLink source). So this stays a plain `Link` with the
  // combined boolean computed by hand, same as StudentDesktopSidebar.
  const isAudioPracticeActive =
    location.pathname === '/practice' ||
    location.pathname.startsWith('/practice/listening') ||
    location.pathname.startsWith('/practice/shadowing') ||
    location.pathname.startsWith('/practice/speaking');

  const items: {
    label: string;
    icon: React.ReactNode;
    to?: string;
    end?: boolean;
    forceActive?: boolean;
  }[] = [
    { label: t.nav.home, icon: <Home size={21} />, to: '/home', end: true },
    // Sprint 05 — matches the desktop sidebar: the Courses slot is now the
    // Grammar module.
    { label: t.nav.grammar, icon: <BookOpen size={21} />, to: '/grammar' },
    { label: t.nav.vocabulary, icon: <BookMarked size={21} />, to: '/vocab' },
    {
      label: t.nav.audioPractice,
      icon: <Headphones size={21} />,
      to: '/practice',
      forceActive: isAudioPracticeActive,
    },
    { label: t.nav.profile, icon: <UserIcon size={21} />, to: '/profile' },
  ];

  return (
    <nav
      aria-label={t.nav.bottomNavigation}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-100 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex">
        {items.map((item) => {
          // The audio-practice slot's `to` is the parent hub (/practice), and
          // its active state must cover /practice plus every mode nested
          // under it (listening/shadowing/speaking) while EXCLUDING
          // /practice/vocab and /practice/review, which share the prefix but
          // are a different section — a plain `startsWith(item.to)` fallback
          // would wrongly light this item up on those routes too, so
          // `forceActive` (computed above) is trusted as the COMPLETE answer
          // here, not OR'd with a prefix match. NavLink's own `to`-based
          // matching can't express this distinction either way, and its
          // `aria-current` can't be overridden by a passed prop (confirmed
          // against react-router's own NavLink source) — hence the plain
          // `Link` with the hand-computed boolean.
          if (item.to && item.forceActive !== undefined) {
            const combinedActive = item.forceActive;
            return (
              <Link
                key={item.label}
                to={item.to}
                aria-current={combinedActive ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center justify-center space-y-1 py-2.5 min-h-[56px] text-[10px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
                  combinedActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
              >
                <span className="relative" aria-hidden="true">
                  {item.icon}
                  {combinedActive && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          }

          return item.to ? (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center space-y-1 py-2.5 min-h-[56px] text-[10px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative" aria-hidden="true">
                    {item.icon}
                    {isActive && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
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
          );
        })}
      </div>
    </nav>
  );
};

export default StudentBottomNavigation;
