
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from './constants';
import { authService } from '../../services/authService';
import AvatarMenu from '../shared/AvatarMenu';

const UserNavbar: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
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

          {/* User Profile with Avatar Menu */}
          <div className="flex items-center space-x-4">
            <button className="text-[13px] font-bold text-slate-400 hover:text-indigo-500 transition-colors mr-2">
               Hỗ trợ
            </button>
            <AvatarMenu
              user={{
                name: user?.name || 'User',
                avatarUrl: avatarUrl,
                role: (user?.role as 'USER' | 'ADMIN') || 'USER',
              }}
              onLogout={handleLogout}
              onAvatarUpdate={handleAvatarUpdate}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default UserNavbar;
