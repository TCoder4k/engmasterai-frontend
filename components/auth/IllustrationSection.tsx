
import React from 'react';
import { Globe, GraduationCap, Cpu, Sparkles, Languages, BookOpen, Laptop, MessageCircle } from 'lucide-react';

export const IllustrationSection: React.FC = () => {
  return (
    <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-500 p-12 overflow-hidden items-center justify-center">
      {/* Decorative Grid Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floating Animated Blobs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-1/3 -right-20 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-20 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-2xl text-white flex flex-col items-center lg:items-start">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span>Nền tảng học Tiếng Anh thông minh nhất</span>
        </div>

        {/* Main Content */}
        <div className="space-y-6 text-left">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white text-indigo-600 rounded-2xl shadow-xl shadow-indigo-900/20">
              <GraduationCap className="w-10 h-10" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight">EngMasterAI</span>
          </div>

          <h1 className="text-6xl font-black leading-[1.1]">
            Chinh phục <br />
            <span className="text-yellow-300">Tiếng Anh</span> <br />
            cùng trí tuệ AI
          </h1>
          
          <p className="text-xl text-indigo-50/80 max-w-lg font-light leading-relaxed">
            Hệ thống học tập cá nhân hóa vượt trội, giúp bạn đạt điểm IELTS cao và giao tiếp tự nhiên như người bản xứ.
          </p>
        </div>

        {/* Visual Elements Grid */}
        <div className="mt-12 grid grid-cols-2 gap-6 w-full max-w-md">
          <div className="p-5 bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl transform hover:scale-105 transition-transform cursor-default group">
            <div className="w-10 h-10 bg-indigo-400/30 rounded-xl flex items-center justify-center mb-3 group-hover:bg-indigo-400/50 transition-colors">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1">Gia sư AI 24/7</h3>
            <p className="text-sm text-indigo-50/70">Sửa lỗi phát âm và ngữ pháp ngay lập tức.</p>
          </div>
          
          <div className="p-5 bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl transform hover:scale-105 transition-transform cursor-default group">
            <div className="w-10 h-10 bg-blue-400/30 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-400/50 transition-colors">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1">Đa dạng khóa học</h3>
            <p className="text-sm text-indigo-50/70">Từ mất gốc đến nâng cao, bám sát thực tế.</p>
          </div>
        </div>

        {/* Dynamic Icons Group */}
        <div className="mt-16 flex items-center gap-8 opacity-60">
          <BookOpen className="w-8 h-8" />
          <Laptop className="w-8 h-8" />
          <Globe className="w-8 h-8" />
          <MessageCircle className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
};
