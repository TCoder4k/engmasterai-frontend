
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
        {/* `overflow-y-auto` lives on this outer div ALONE — centering
            (`items-center`) must never share a scroll container with it.
            Flexbox centers overflowing content symmetrically, clipping the
            top by exactly as much as the bottom; on a viewport too short
            for the full form, that cut the logo off above the visible
            area with no way to scroll up to it. The inner `min-h-full`
            wrapper below centers only when it has room to spare — once its
            content is taller, `min-h-full` yields to the content's real
            height and layout falls back to plain top-to-bottom flow inside
            the (correctly) scrollable outer div. */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 xl:px-20 py-4 lg:py-6 xl:py-8">
          <div className="min-h-full w-full flex flex-col items-center justify-center py-2">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
