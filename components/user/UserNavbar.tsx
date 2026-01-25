
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from './constants';
import { authService } from '../../services/authService';

const UserNavbar: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-100/80">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center space-x-12">
            <Link to="/home" className="flex items-center space-x-2.5">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-extrabold text-xl">E</span>
              </div>
              <span className="text-2xl font-extrabold text-slate-900 logo-text">
                Engmaster<span className="text-indigo-500">AI</span>
              </span>
            </Link>
            
            {/* Nav Links - Professional Spacing */}
            <div className="hidden lg:flex space-x-10">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`text-[14px] font-bold transition-all duration-200 hover:text-indigo-500 ${
                    item.isActive 
                      ? 'text-indigo-500' 
                      : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* User Profile - Minimal Style */}
          <div className="flex items-center space-x-4">
            <button className="text-[13px] font-bold text-slate-400 hover:text-indigo-500 transition-colors mr-2">
               Hỗ trợ
            </button>
            <div className="flex items-center space-x-3 bg-slate-50 p-1 rounded-full border border-slate-100 group cursor-pointer hover:bg-white hover:shadow-sm transition-all">
               <div className="w-9 h-9 rounded-full border border-slate-200 overflow-hidden bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-sm">{user?.name?.charAt(0) || 'U'}</span>
               </div>
               <span className="text-[12px] font-bold text-slate-700 pr-3 uppercase tracking-tight">
                 {user?.name?.split(' ')[0] || 'User'}
               </span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-[13px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default UserNavbar;
