
import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BookText,
  Library,
  Gamepad2,
  LineChart,
  Wallet,
  Settings,
  LogOut,
  Zap
} from 'lucide-react';
import { authService } from '../../services/authService';

const navLinkClass = (isActive: boolean) =>
  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
    isActive
      ? 'bg-indigo-50 text-indigo-600 shadow-sm'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
  }`;

// Nav items with no backing page/API yet — rendered disabled with a "Sắp có"
// badge rather than a dead href="#" link, so it's honest about what's not
// built instead of looking like a broken link.
const comingSoonItems = [
  { icon: <BookText size={20} />, label: 'Bài học (Lessons)' },
  { icon: <Zap size={20} />, label: 'Luyện tập (Practice)' },
  { icon: <Gamepad2 size={20} />, label: 'Hệ thống Level' },
  { icon: <LineChart size={20} />, label: 'Phân tích học tập' },
  { icon: <Wallet size={20} />, label: 'Doanh thu' },
];

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <aside className="w-68 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 overflow-hidden">
      <Link to="/admin" className="p-6 flex items-center space-x-3 border-b border-slate-50">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
          <Zap className="text-white w-5 h-5 fill-white" />
        </div>
        <div>
          <span className="text-lg font-black text-slate-900 leading-none block">EngMasterAI</span>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Admin Portal</span>
        </div>
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

        {/* No `end` — stays active on the nested /admin/vocab/libraries/:id/decks page too */}
        <NavLink to="/admin/vocab" className={({ isActive }) => navLinkClass(isActive)}>
          <Library size={20} />
          <span>Từ vựng (Vocabulary)</span>
        </NavLink>

        {comingSoonItems.map((item, index) => (
          <div
            key={index}
            aria-disabled="true"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 cursor-not-allowed select-none"
          >
            <span className="flex items-center space-x-3">
              {item.icon}
              <span>{item.label}</span>
            </span>
            <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md">
              Sắp có
            </span>
          </div>
        ))}

        <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Cấu hình</p>
        <div
          aria-disabled="true"
          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 cursor-not-allowed select-none"
        >
          <span className="flex items-center space-x-3">
            <Settings size={20} />
            <span>Cài đặt hệ thống</span>
          </span>
          <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md">
            Sắp có
          </span>
        </div>
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
