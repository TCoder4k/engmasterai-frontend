import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  GraduationCap,
  Home,
  BookOpen,
  Headphones,
  BookMarked,
  User as UserIcon,
  Settings,
  Crown,
  Gem,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const HEXAGON_CLIP = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';

const navLinkClass = (isActive: boolean) =>
  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
    isActive
      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
  }`;

// Desktop-only left sidebar (hidden below lg — phones/tablets use
// StudentMobileHeader + StudentBottomNavigation instead).
const StudentDesktopSidebar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col h-screen sticky top-0 overflow-hidden flex-shrink-0">
      <div className="p-6">
        {/* The whole brand area is a real router link back to the Dashboard
            (Sprint 03E) — client-side navigation, keyboard focusable, no
            clickable <div>. */}
        <NavLink
          to="/home"
          aria-label={t.nav.goToDashboard}
          className="flex items-center space-x-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <GraduationCap size={30} className="text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <span className="text-xl font-extrabold text-slate-900 dark:text-white">EngMasterAI</span>
        </NavLink>
      </div>

      <nav aria-label={t.nav.mainNavigation} className="flex-1 px-4 space-y-1 overflow-y-auto">
        <NavLink to="/home" end className={({ isActive }) => navLinkClass(isActive)}>
          <Home size={20} aria-hidden="true" />
          <span>{t.nav.dashboard}</span>
        </NavLink>

        <NavLink to="/courses" className={({ isActive }) => navLinkClass(isActive)}>
          <BookOpen size={20} aria-hidden="true" />
          <span>{t.nav.myCourses}</span>
        </NavLink>

        {/* Sprint 03D: the generic "Practice" nav item is replaced by a
            dedicated Listening entry — Vocabulary practice is reached via
            the Vocabulary section below instead (see VocabLibraryPage ->
            LibraryDetailPage's deck list). /practice (the hub) remains an
            internal compatibility route, no longer primary navigation. */}
        <NavLink to="/practice/listening" className={({ isActive }) => navLinkClass(isActive)}>
          <Headphones size={20} aria-hidden="true" />
          <span>{t.nav.listening}</span>
        </NavLink>

        <NavLink to="/vocab" className={({ isActive }) => navLinkClass(isActive)}>
          <BookMarked size={20} aria-hidden="true" />
          <span>{t.nav.vocabulary}</span>
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) => navLinkClass(isActive)}>
          <UserIcon size={20} aria-hidden="true" />
          <span>{t.nav.profile}</span>
        </NavLink>

        <NavLink to="/security" className={({ isActive }) => navLinkClass(isActive)}>
          <Settings size={20} aria-hidden="true" />
          <span>{t.nav.settings}</span>
        </NavLink>
      </nav>

      <div className="p-4 space-y-4">
        {/* Level/XP preview — totalPoints/level exist on the User model but no
            API returns them yet, so no numbers are shown (static-data honesty). */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div
              className="w-12 h-12 bg-indigo-600 flex items-center justify-center text-white flex-shrink-0"
              style={{ clipPath: HEXAGON_CLIP }}
              aria-hidden="true"
            >
              <Gem size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{t.widgets.level}</p>
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{t.common.comingSoon}</p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full" />
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-2">{t.common.noDataYet}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5">
          <div className="flex items-center space-x-2 mb-1.5">
            <Crown size={18} className="text-amber-400 fill-amber-400" aria-hidden="true" />
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{t.premium.goPremium}</p>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            {t.premium.pitch}
          </p>
          {/* Visual CTA only — no payment/subscription flow exists yet. */}
          <button
            type="button"
            title={t.common.comingSoon}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {t.premium.upgradeNow}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default StudentDesktopSidebar;
