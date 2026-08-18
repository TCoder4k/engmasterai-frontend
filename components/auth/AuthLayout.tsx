
import React from 'react';
import { Outlet } from 'react-router-dom';
import { IllustrationSection } from './IllustrationSection';

export const AuthLayout: React.FC = () => {
  return (
    <div className="h-screen w-full flex overflow-hidden bg-slate-50 selection:bg-blue-100 selection:text-blue-700">
      {/* Two-Column Layout */}
      <div className="flex w-full">
        {/* Left Side: Illustration */}
        <IllustrationSection />

        {/* Right Side: Form Content */}
        <div className="flex-1 flex items-center justify-center px-6 lg:px-12 xl:px-20 py-4 lg:py-6 xl:py-8 overflow-y-auto">
          <div className="w-full flex justify-center py-2">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
