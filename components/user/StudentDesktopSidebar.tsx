import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Headphones,
  BookMarked,
  User as UserIcon,
  Settings,
  Crown,
  Zap,
  Gem,
  Flame,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { authService } from '../../services/authService';
import { Logo } from '../shared/Logo';

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
  const { t, language } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = authService.getUser();
  const dateLocale = language === 'vi' ? 'vi-VN' : 'en-US';

  const hasPro = Boolean(user?.isPro);
  const hasHocTap = Boolean(user?.isHocTap || user?.isPremium);
  const isSubscribed = hasPro || hasHocTap;
  const proDaysUntilExpiry = user?.proExpiresAt
    ? Math.ceil((new Date(user.proExpiresAt).getTime() - Date.now()) / 86400000)
    : null;
  const hocTapDaysUntilExpiry = user?.hocTapExpiresAt
    ? Math.ceil((new Date(user.hocTapExpiresAt).getTime() - Date.now()) / 86400000)
    : null;
  const expiringPlan =
    hasPro && hasHocTap
      ? (proDaysUntilExpiry ?? Infinity) <= (hocTapDaysUntilExpiry ?? Infinity)
        ? 'PRO'
        : 'HOC_TAP'
      : hasPro
        ? 'PRO'
        : hasHocTap
          ? 'HOC_TAP'
          : null;
  const expiringDays = expiringPlan === 'PRO' ? proDaysUntilExpiry : hocTapDaysUntilExpiry;
  const isExpiringSoon =
    isSubscribed && expiringDays !== null && expiringDays !== null && expiringDays <= 14;
  const expiringDate =
    expiringPlan === 'PRO' ? user?.proExpiresAt : user?.hocTapExpiresAt;

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
    <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col h-dvh sticky top-0 flex-shrink-0">
      <div className="shrink-0 px-6 pt-6 pb-5">
        {/* The whole brand area is a real router link back to the Dashboard
            (Sprint 03E) — client-side navigation, keyboard focusable, no
            clickable <div>. */}
        <NavLink
          to="/home"
          aria-label={t.nav.goToDashboard}
          className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 block"
        >
          <Logo size="md" />
        </NavLink>
      </div>

      <nav aria-label={t.nav.mainNavigation} className="min-h-0 flex-1 overflow-y-auto px-4 space-y-1 sidebar-scrollbar">
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

        {/* Streak Together — entered from Community Chat, but a user with
            multiple concurrent streaks (allowed by product decision) needs
            somewhere to see all of them at once, hence this nav entry
            pointing at the list page (/streaks). */}
        <NavLink to="/streaks" className={({ isActive }) => navLinkClass(isActive)}>
          <Flame size={20} aria-hidden="true" />
          <span>{t.nav.streaks}</span>
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

      <div className="shrink-0 p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
        {/* Dashboard redesign (2026-09) — the standalone Level/XP card moved
            out of the sidebar into the desktop topbar, next to the avatar
            (StudentLayout.tsx), so this rail carries one fewer competing
            card. Level/XP data itself is unchanged — same GamificationProvider
            source, just a different, more compact presentation. */}

        <div className={`rounded-2xl border p-4 ${
          isExpiringSoon
            ? 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10'
            : hasPro && hasHocTap
              ? 'border-blue-200 bg-blue-50/60 dark:border-blue-500/25 dark:bg-blue-500/10'
              : 'border-amber-200 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white shadow-sm dark:from-amber-500/15 dark:via-orange-500/10 dark:to-slate-900 dark:border-amber-500/25'
        }`}>
          <div className="flex items-center space-x-2 mb-1.5">
            {isExpiringSoon && expiringPlan === 'PRO' ? <Zap
              size={22}
              className="text-blue-500 fill-blue-500"
              aria-hidden="true"
            /> : <Crown
              size={22}
              className="text-amber-400 fill-amber-400"
              aria-hidden="true"
            />}
            <p
              className={`text-sm font-extrabold ${
                isExpiringSoon ? 'text-amber-900 dark:text-amber-200' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {!isSubscribed
                ? 'Nâng cấp tài khoản'
                : isExpiringSoon
                  ? expiringPlan === 'PRO'
                    ? 'Gói Pro AI sắp hết hạn'
                    : 'Gói Học Tập sắp hết hạn'
                  : hasPro && hasHocTap
                    ? 'Premium All-Access'
                    : hasHocTap
                      ? 'Gói Học Tập'
                      : 'Gói Pro AI'}
            </p>
          </div>
          {isExpiringSoon && expiringDate ? (
            <p
              className="mb-3 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-200/80"
            >
              Còn {Math.max(0, expiringDays ?? 0)} ngày (Hết hạn: {new Date(expiringDate).toLocaleDateString(dateLocale)})
            </p>
          ) : !isSubscribed ? (
            <p className="mb-3 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Mở khóa trọn bộ bài học & AI
            </p>
          ) : hasPro && hasHocTap ? (
            <p className="mb-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Đã kích hoạt trọn bộ đặc quyền
            </p>
          ) : hasHocTap ? (
            <p className="mb-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Hiệu lực: {new Date(user?.hocTapExpiresAt ?? '').toLocaleDateString(dateLocale)}
            </p>
          ) : (
            <p className="mb-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Hiệu lực: {new Date(user?.proExpiresAt ?? '').toLocaleDateString(dateLocale)}
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate(
              !isSubscribed
                ? '/premium'
                : isExpiringSoon
                  ? expiringPlan === 'PRO'
                    ? '/checkout'
                    : '/checkout?plan=PREMIUM_MONTHLY'
                  : hasPro && hasHocTap
                    ? '/profile'
                    : hasHocTap
                      ? '/checkout'
                      : '/checkout?plan=PREMIUM_MONTHLY',
            )}
            className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold whitespace-nowrap transition-all transform active:scale-[.98] focus:outline-none focus-visible:ring-2 ${
              isExpiringSoon
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 focus-visible:ring-amber-400'
                : hasPro && hasHocTap
                  ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  : 'bg-gradient-to-r from-[#f5a000] to-[#f26a00] text-white shadow-lg shadow-orange-500/30 hover:from-[#e89000] hover:to-[#e85d00] focus-visible:ring-orange-400'
            }`}
          >
            {!isSubscribed
              ? 'Nâng cấp ngay ➔'
              : isExpiringSoon
                ? expiringPlan === 'PRO'
                  ? 'Gia hạn Pro (19k/tháng)'
                  : 'Gia hạn Gói Học Tập'
                : hasPro && hasHocTap
                  ? 'Xem chi tiết gói ➔'
                  : hasHocTap
                    ? 'Nâng cấp Pro AI (+19k)'
                    : 'Mở khóa Gói Học Tập 👑'}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default StudentDesktopSidebar;
