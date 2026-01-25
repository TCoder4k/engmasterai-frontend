
import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Bell, Menu, ExternalLink } from 'lucide-react';
import { authService } from '../../services/authService';

const AdminHeader: React.FC = () => {
  const user = authService.getUser();

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
            type="text" 
            placeholder="Tìm học viên, bài học hoặc mã giao dịch..." 
            className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 w-96 transition-all"
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

        <button className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="flex items-center space-x-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900 leading-none">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase">Super Admin</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-indigo-100 border border-slate-200 overflow-hidden shadow-sm ring-2 ring-white flex items-center justify-center">
            <span className="text-indigo-600 font-bold text-sm">{user?.name?.charAt(0) || 'A'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
