
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, ExternalLink } from 'lucide-react';
import { authService } from '../../services/authService';
import AvatarMenu from '../shared/AvatarMenu';

const SEARCH_DEBOUNCE_MS = 350;
const STUDENTS_PATH = '/admin/users';

const AdminHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getUser();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);

  // Only "học viên" search is actually implemented today (the placeholder
  // also mentions lessons/transaction codes as future scope — see
  // AdminUsers.tsx, the only page this currently searches). Seeded from the
  // URL so landing on/refreshing the Students page with ?q= shows the term
  // that produced the results on screen, instead of a blank box.
  const [query, setQuery] = useState(() =>
    location.pathname === STUDENTS_PATH
      ? new URLSearchParams(location.search).get('q') ?? ''
      : '',
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // Typing here mid-word navigates to the Students page, which mounts a
  // BRAND NEW instance of this header (each admin page renders its own —
  // there is no shared layout instance), so the input the person was just
  // typing into is a different DOM node with no focus of its own. Left
  // alone, the box shows the right text but the next keystroke goes
  // nowhere — reported 2026-09-15. Reclaimed once, on mount, only when we
  // actually arrived here carrying a search term (so a plain sidebar click
  // to Students, with nothing typed, never steals focus for no reason).
  useEffect(() => {
    if (location.pathname !== STUDENTS_PATH || !query) return;
    const el = inputRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps this box in sync with `q` when it changes without a remount —
  // browser back/forward while staying on the Students page, since that's
  // a search-param-only URL change and React Router re-renders this same
  // header instance rather than creating a new one (unlike the cross-page
  // navigation case handled above).
  useEffect(() => {
    if (location.pathname !== STUDENTS_PATH) return;
    const urlQuery = new URLSearchParams(location.search).get('q') ?? '';
    setQuery((current) => (current === urlQuery ? current : urlQuery));
  }, [location.pathname, location.search]);

  useEffect(() => {
    const trimmed = query.trim();
    const onStudentsPage = location.pathname === STUDENTS_PATH;
    const currentQuery = onStudentsPage
      ? new URLSearchParams(location.search).get('q') ?? ''
      : '';
    if (trimmed === currentQuery) return;
    // Typing anywhere in the admin area jumps to the Students page's search
    // results, same as a global quick-search bar; typed there already, it
    // just updates the query string in place instead of stacking history.
    if (!trimmed && !onStudentsPage) return;
    const timer = window.setTimeout(() => {
      const target = trimmed ? `${STUDENTS_PATH}?q=${encodeURIComponent(trimmed)}` : STUDENTS_PATH;
      navigate(target, { replace: onStudentsPage });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleLogout = async () => {
    const { degraded } = await authService.logout();
    if (degraded) {
      // Server-side revocation couldn't be confirmed (Redis unreachable, or
      // the request never reached the backend) — the frontend session is
      // still fully cleared and the redirect still happens; this is just a
      // best-effort heads-up in the console (no new UI affordance this
      // sprint — see docs/memory.md Sprint 01B notes).
      console.warn('Logout: server-side session revocation could not be confirmed.');
    }
    navigate('/login');
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-6">
        <button className="lg:hidden p-2 text-slate-500">
          <Menu size={20} />
        </button>
        <div className="hidden lg:flex flex-col">
          <h2 className="text-sm font-bold text-slate-800">Trung tâm điều hành EngMasterAI</h2>
          <p className="text-[10px] text-slate-400 font-medium">English Learning Management System v2.4</p>
        </div>
        <div className="relative hidden xl:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter jumps immediately rather than waiting out the debounce.
              if (e.key !== 'Enter') return;
              const trimmed = query.trim();
              navigate(trimmed ? `${STUDENTS_PATH}?q=${encodeURIComponent(trimmed)}` : STUDENTS_PATH);
            }}
            placeholder="Tìm học viên, bài học hoặc mã giao dịch..."
            className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 w-96 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Link 
          to="/"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200"
        >
          <ExternalLink size={14} />
          <span className="hidden sm:inline">Xem Landing Page</span>
        </Link>
        
        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
        
        {/* variant="admin": the admin layout has no dark mode, so the menu
            must stay light even when the global .dark class is set. */}
        <AvatarMenu
          variant="admin"
          user={{
            name: user?.name || 'Admin',
            avatarUrl: avatarUrl,
            role: (user?.role as 'USER' | 'ADMIN') || 'ADMIN',
          }}
          onLogout={handleLogout}
          onAvatarUpdate={handleAvatarUpdate}
        />
      </div>
    </header>
  );
};

export default AdminHeader;
