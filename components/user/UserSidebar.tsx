
import React from 'react';
import { authService } from '../../services/authService';

const UserSidebar: React.FC = () => {
  const user = authService.getUser();
  const currentExp = 393;
  const nextLevelExp = 1013;
  const level = 29;

  return (
    <aside className="space-y-6">
      {/* User Progress - Professional Card */}
      <div className="bg-white rounded-[24px] shadow-lg p-8 flex flex-col border border-slate-50">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Trình độ</p>
            <p className="text-xl font-black text-slate-900">Cấp độ {level}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-[12px] font-bold text-slate-500">
             <span>Kinh nghiệm</span>
             <span className="text-indigo-500">{currentExp} XP</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
             <div 
               className="h-full bg-indigo-500" 
               style={{ width: `${(currentExp/nextLevelExp)*100}%` }}
             />
          </div>
          <p className="text-[11px] text-slate-400 font-medium text-center pt-2">
            Còn {nextLevelExp - currentExp} XP để lên cấp tiếp theo
          </p>
        </div>
      </div>

      {/* Guide/Certification Section */}
      <div className="bg-slate-900 rounded-[24px] p-8 flex flex-col items-start text-left group cursor-pointer transition-all hover:bg-slate-800">
        <h4 className="text-[16px] font-bold text-white mb-2">
          Chứng chỉ hoàn thành
        </h4>
        <p className="text-[13px] text-slate-400 mb-6 font-medium">
          Chứng chỉ của bạn được công nhận bởi cộng đồng EngmasterAI toàn cầu.
        </p>
        <button className="text-[13px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-2">
          <span>Xem chi tiết</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default UserSidebar;
