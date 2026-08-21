
import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Library,
  BookMarked,
  Headphones,
  ListChecks,
  LogOut
} from 'lucide-react';
import { authService } from '../../services/authService';
import { Logo } from '../shared/Logo';

const navLinkClass = (isActive: boolean) =>
  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
    isActive
      ? 'bg-blue-50 text-blue-600 shadow-sm'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
  }`;

// Sprint 06D — "Bài học (Lessons)" and "Luyện tập (Practice)" were REMOVED
// from this nav because both were misleading, in different ways:
//
//   Lessons  — already manageable, just not from here. They are reached
//              through Khóa học → a course → its lessons, which is the right
//              hierarchy (a lesson has no meaning without its course). The
//              badge implied a missing feature that has existed since Sprint 05.
//   Practice — as of Sprint 06D, authored per lesson from the lesson row,
//              beside Quiz. Neither is a top-level section, so neither gets a
//              nav item; a "Coming soon" badge on a shipped feature is the
//              same lie in the other direction.
//
// 2026-08-21 — "Hệ thống Level", "Phân tích học tập", "Doanh thu" and "Cài
// đặt hệ thống" (genuinely unbuilt: no page, no API, no route) used to render
// here as disabled rows with a "Sắp có" badge, on the reasoning that a
// disabled row is more honest than hiding the roadmap entirely. For a
// demo-facing build, four repeated "Sắp có" badges reads as unfinished
// rather than transparent, so they're removed from the nav until they ship —
// same honesty rule, different audience: nothing here claims to be real, but
// nothing unbuilt is on display either.

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // "Từ vựng" covers /admin/vocab and its library/deck sub-routes, but must
  // NOT stay highlighted on /admin/vocab/words — that's now its own distinct
  // nav item ("Ngân hàng từ"), even though it's nested one level under the
  // same /admin/vocab path prefix. NavLink's own prefix matching can't
  // express that exclusion, so the active state is computed manually here.
  const isVocabLibrariesActive =
    location.pathname.startsWith('/admin/vocab') && !location.pathname.startsWith('/admin/vocab/words');

  const handleLogout = async () => {
    const { degraded } = await authService.logout();
    if (degraded) {
      console.warn('Logout: server-side session revocation could not be confirmed.');
    }
    navigate('/login');
  };

  return (
    <aside className="w-68 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 overflow-hidden">
      <Link to="/admin" className="p-6 flex items-center border-b border-slate-50">
        <Logo size="md">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter mt-0.5">Admin Portal</span>
        </Logo>
      </Link>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Điều hành hệ thống</p>

        {/* `end` keeps Dashboard from staying highlighted on every /admin/* route */}
        <NavLink to="/admin" end className={({ isActive }) => navLinkClass(isActive)}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/admin/users" className={({ isActive }) => navLinkClass(isActive)}>
          <Users size={20} />
          <span>Học viên & Users</span>
        </NavLink>

        {/* No `end` — stays active on the nested /admin/courses/:id/lessons page too */}
        <NavLink to="/admin/courses" className={({ isActive }) => navLinkClass(isActive)}>
          <BookOpen size={20} />
          <span>Khóa học (Courses)</span>
        </NavLink>

        {/* Active state is computed manually (see isVocabLibrariesActive
            above) rather than via NavLink's own prefix matching, so this
            doesn't stay highlighted on /admin/vocab/words. */}
        <NavLink to="/admin/vocab" className={() => navLinkClass(isVocabLibrariesActive)}>
          <Library size={20} />
          <span>Từ vựng (Vocabulary)</span>
        </NavLink>

        {/* No `end` — stays active on /admin/vocab/words/new and
            /admin/vocab/words/:wordId/edit too. */}
        <NavLink to="/admin/vocab/words" className={({ isActive }) => navLinkClass(isActive)}>
          <BookMarked size={20} />
          <span>Ngân hàng từ (Word Bank)</span>
        </NavLink>

        {/* Sprint 11 — no `end`, so it stays active on the categories page and
            the per-content editor nested beneath it. A real nav item rather
            than a "Sắp có" badge: the page, the API and the route all exist. */}
        <NavLink to="/admin/listening" className={({ isActive }) => navLinkClass(isActive)}>
          <Headphones size={20} />
          <span>Listening (Nội dung)</span>
        </NavLink>

        {/* Personalized Onboarding & Placement Test — the dedicated question
            bank (Phase 2). No `end`: this is the only route under this
            section today, but kept consistent with the other content-bank
            nav items above in case a coverage/preview sub-route is added
            later. */}
        <NavLink to="/admin/placement/questions" className={({ isActive }) => navLinkClass(isActive)}>
          <ListChecks size={20} />
          <span>Kiểm tra đầu vào</span>
        </NavLink>

      </nav>

      <div className="p-4 border-t border-slate-50 bg-slate-50/50">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-rose-500 hover:bg-rose-100/50 transition-all"
        >
          <LogOut size={20} />
          <span>Đăng xuất hệ thống</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
