
import React, { useState, useEffect } from 'react';
import UserNavbar from './UserNavbar';
import UserSidebar from './UserSidebar';
import CourseCard from './CourseCard';
import { COURSES } from './constants';

const UserHome: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <UserNavbar />

      <main className="flex-grow py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="flex flex-col lg:flex-row gap-16">
            {/* Main Content Area - Wide Spacing */}
            <div className="flex-grow">
              <div className="mb-12">
                <h2 className="text-[22px] font-black text-slate-900 uppercase tracking-tight">
                  Khóa học của tôi
                </h2>
                <div className="h-1 w-12 bg-indigo-500 mt-2.5 rounded-full"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
                {COURSES.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </div>

            {/* Sidebar Area - Fixed width for clean look */}
            <div className="w-full lg:w-[340px] flex-shrink-0">
              <UserSidebar />
            </div>
          </div>
        </div>
      </main>

      {/* Floating Support Button - Subtle & Professional */}
      <div className="fixed bottom-10 right-10 z-50 group">
        <div className="w-16 h-16 bg-white border border-slate-100 shadow-xl rounded-[20px] flex items-center justify-center cursor-pointer active:scale-95 transition-all hover:bg-slate-50 group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
      </div>
      
      {/* Footer - Minimalist */}
      <footer className="py-12 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-[12px] font-bold text-slate-300 uppercase tracking-widest">
            © 2024 EngmasterAI Platform
          </p>
          <div className="flex space-x-10 mt-6 md:mt-0">
            <span className="text-[12px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors">Điều khoản</span>
            <span className="text-[12px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors">Bảo mật</span>
            <span className="text-[12px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors">Học tập</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default UserHome;
