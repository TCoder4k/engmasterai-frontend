
import React from 'react';
import { Outlet } from 'react-router-dom';
import { IllustrationSection } from './IllustrationSection';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex bg-slate-50 selection:bg-indigo-100 selection:text-indigo-700">
      {/* Two-Column Layout */}
      <div className="flex w-full">
        {/* Left Side: Illustration */}
        <IllustrationSection />

        {/* Right Side: Form Content */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 xl:p-24 overflow-y-auto">
          <div className="w-full flex justify-center py-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
