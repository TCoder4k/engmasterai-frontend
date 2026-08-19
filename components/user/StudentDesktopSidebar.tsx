import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
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
import { Logo } from '../shared/Logo';
import LevelWidget from './LevelWidget';

const HEXAGON_CLIP = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';

const navLinkClass = (isActive: boolean) =>
  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
    isActive
      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
  }`;

// Desktop-only left sidebar (hidden below lg — phones/tablets use
// StudentMobileHeader + StudentBottomNavigation instead).
const StudentDesktopSidebar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // /practice is now this item's own target (the shared Nghe-nói hub), so
  // NavLink's own `to`-based matching would need to cover /practice AND every
  // mode nested under it (listening, shadowing, speaking) while EXCLUDING
  // /practice/vocab and /practice/review, which live under the same prefix
  // but belong to a different section. That's more than a single `to` match
  // can express, and NavLink's `aria-current` is derived entirely from its
  // own isActive and cannot be overridden by a passed prop (react-router
  // computes it internally: `isActive ? ariaCurrentProp : undefined`), so
  // this entry is rendered as a plain `Link` below with the combined boolean
  // computed by hand — see StudentBottomNavigation's matching comment.
  const isAudioPracticeActive =
    location.pathname === '/practice' ||
    location.pathname.startsWith('/practice/listening') ||
    location.pathname.startsWith('/practice/shadowing') ||
    location.pathname.startsWith('/practice/speaking');

  return (
    <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col h-screen sticky top-0 overflow-hidden flex-shrink-0">
      <div className="p-6">
        {/* The whole brand area is a real router link back to the Dashboard
            (Sprint 03E) — client-side navigation, keyboard focusable, no
            clickable <div>. */}
        <NavLink
          to="/home"
          aria-label={t.nav.goToDashboard}
          className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Logo size="md" />
        </NavLink>
      </div>

      <nav aria-label={t.nav.mainNavigation} className="flex-1 px-4 space-y-1 overflow-y-auto">
        <NavLink to="/home" end className={({ isActive }) => navLinkClass(isActive)}>
          <Home size={20} aria-hidden="true" />
          <span>{t.nav.dashboard}</span>
        </NavLink>

        {/* Sprint 05: "My Courses" (-> /courses, the generic all-type catalog)
            became the Grammar module. /courses is deliberately kept as a
            working route — the Dashboard's course cards, and deep links
            already stored in students' localStorage, still use it — it just
            is no longer primary navigation. */}
        <NavLink to="/grammar" className={({ isActive }) => navLinkClass(isActive)}>
          <BookOpen size={20} aria-hidden="true" />
          <span>{t.nav.grammar}</span>
        </NavLink>

        {/* "Nghe - nói" opens /practice — the shared Listening/Shadowing +
            Speaking Partner mode-selection hub. Realigned from a same-day
            Sprint 13 follow-up that had instead sent this link straight to
            /practice/listening and given Speaking Partner its own separate
            NavLink below; the product owner's own reference design puts both
            modes behind ONE nav item, chosen at /practice, not two competing
            top-level entries. /practice is primary navigation again — no
            longer the compatibility-only route it was under Sprint 03D.

            Vocabulary practice is still reached via the Vocabulary section
            below instead (see VocabLibraryPage -> LibraryDetailPage's deck
            list) — /practice also carries a Vocabulary/Review shortcut
            section, but that isn't this item's job.

            Sprint 11 — ONE entry for both Dictation and Shadowing, not two.
            An earlier revision gave each its own NavLink here ("Chủ đề" for
            Dictation, a separate "Shadowing" item); once
            ListeningCatalogPage grew an in-page Dictation<->Shadowing toggle
            in its hero, a second nav item pointing at the same shared
            catalog was redundant. `/practice/shadowing` still exists and
            still resolves — the toggle navigates there — it is simply
            reached one step further in, not as its own top-level item. */}
        <Link
          to="/practice"
          aria-current={isAudioPracticeActive ? 'page' : undefined}
          className={navLinkClass(isAudioPracticeActive)}
        >
          <Headphones size={20} aria-hidden="true" />
          <span>{t.nav.audioPractice}</span>
        </Link>

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
        {/* Sprint 10 — REAL. This was a "Coming soon" placeholder whose comment
            claimed no API returned totalPoints/level; that was wrong (GET
            /users/me always has), and the real gap was that nothing awarded
            them. The XP ledger closes it. Data comes from GamificationProvider,
            mounted once per session as a layout route — see App.tsx. */}
        <LevelWidget />

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
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {t.premium.upgradeNow}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default StudentDesktopSidebar;
