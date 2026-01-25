
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  BookText, 
  Gamepad2, 
  LineChart, 
  Wallet, 
  Settings, 
  LogOut,
  Zap
} from 'lucide-react';
import { authService } from '../../services/authService';

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', active: true },
    { icon: <Users size={20} />, label: 'Học viên & Users', active: false },
    { icon: <BookOpen size={20} />, label: 'Khóa học (Courses)', active: false },
    { icon: <BookText size={20} />, label: 'Bài học (Lessons)', active: false },
    { icon: <Zap size={20} />, label: 'Luyện tập (Practice)', active: false },
    { icon: <Gamepad2 size={20} />, label: 'Hệ thống Level', active: false },
    { icon: <LineChart size={20} />, label: 'Phân tích học tập', active: false },
    { icon: <Wallet size={20} />, label: 'Doanh thu', active: false },
  ];

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
        {menuItems.map((item, index) => (
          <a
            key={index}
            href="#"
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              item.active 
                ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        ))}

        <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Cấu hình</p>
        <a href="#" className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all">
          <Settings size={20} />
          <span>Cài đặt hệ thống</span>
        </a>
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
