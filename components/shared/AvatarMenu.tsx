import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut, ChevronDown, Shield, Camera } from 'lucide-react';
import { uploadAvatar } from '../../services/userService';

export interface AvatarMenuUser {
  name: string;
  avatarUrl?: string;
  role: 'USER' | 'ADMIN';
}

interface AvatarMenuProps {
  user: AvatarMenuUser;
  onLogout: () => void;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
}

const AvatarMenu: React.FC<AvatarMenuProps> = ({ user, onLogout, onAvatarUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMenu();
    }
  };

  const getRoleLabel = (role: string) => {
    return role === 'ADMIN' ? 'Quản trị viên' : 'Học viên';
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'ADMIN' 
      ? 'bg-amber-100 text-amber-700' 
      : 'bg-indigo-100 text-indigo-700';
  };

  const getInitial = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || 'U';
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      setError('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('Kích thước ảnh không được vượt quá 10MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const userData = await uploadAvatar(file);
      
      // Update local storage
      const currentUser = localStorage.getItem('user');
      if (currentUser) {
        const parsedUser = JSON.parse(currentUser);
        localStorage.setItem('user', JSON.stringify({
          ...parsedUser,
          avatarUrl: userData.avatarUrl
        }));
      }

      // Notify parent component
      if (onAvatarUpdate && userData.avatarUrl) {
        onAvatarUpdate(userData.avatarUrl);
      }

      // Close menu after successful upload
      setTimeout(() => setIsOpen(false), 1000);
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setError(err.message || 'Không thể tải ảnh lên');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      {/* Avatar Trigger Button */}
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        onKeyDown={handleKeyDown}
        className="flex items-center space-x-2.5 bg-slate-50 hover:bg-white px-2 py-1.5 rounded-full border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center ring-2 ring-white shadow-sm">
          {user.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={user.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-bold text-sm">
              {getInitial(user.name)}
            </span>
          )}
        </div>

        {/* Name */}
        <span className="text-xs font-semibold text-slate-700 hidden sm:block max-w-[100px] truncate">
          {user.name?.split(' ')[0] || 'User'}
        </span>

        {/* Chevron */}
        <ChevronDown 
          size={14} 
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      <div
        ref={menuRef}
        className={`absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 transform transition-all duration-200 origin-top-right ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="user-menu"
      >
        {/* User Info Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="relative group/avatar">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center ring-2 ring-white shadow-md">
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-full">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
                {user.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-base">
                    {getInitial(user.name)}
                  </span>
                )}
              </div>
              <button
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 transition-colors shadow-md opacity-0 group-hover/avatar:opacity-100 disabled:opacity-50"
                title="Thay đổi ảnh đại diện"
              >
                <Camera size={10} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                {user.name}
              </p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getRoleBadgeColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
              {error && (
                <p className="text-[10px] text-rose-500 mt-1">{error}</p>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1.5">
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors group"
            role="menuitem"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
              <User size={16} className="text-slate-500 group-hover:text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold">Thông tin tài khoản</p>
              <p className="text-[11px] text-slate-400 group-hover:text-indigo-500">Cập nhật hồ sơ cá nhân</p>
            </div>
          </Link>

          <Link
            to="/security"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors group"
            role="menuitem"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
              <Shield size={16} className="text-slate-500 group-hover:text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold">Bảo mật tài khoản</p>
              <p className="text-[11px] text-slate-400 group-hover:text-indigo-500">Thay đổi mật khẩu</p>
            </div>
          </Link>

          {/* Divider */}
          <div className="my-1.5 mx-4 border-t border-slate-100"></div>

          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex items-center space-x-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors w-full group"
            role="menuitem"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
              <LogOut size={16} className="text-slate-500 group-hover:text-rose-500" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Đăng xuất</p>
              <p className="text-[11px] text-slate-400 group-hover:text-rose-400">Thoát khỏi tài khoản</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarMenu;
