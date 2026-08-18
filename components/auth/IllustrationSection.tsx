
import React from 'react';
import { Cpu, Languages, Sparkles, Star } from 'lucide-react';
import { Logo } from '../shared/Logo';

// Same four faces Hero.tsx uses for its own social-proof row — one visual
// vocabulary for "real students" across the marketing and auth surfaces.
const AVATAR_PHOTOS = [
  'photo-1534528741775-53994a69daeb',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1573496359142-b8d87734a5a2',
  'photo-1500648767791-00dcc994a43e',
];

export const IllustrationSection: React.FC = () => {
  return (
    <div className="hidden lg:flex flex-col flex-1 relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-8 xl:p-10 overflow-hidden text-white">
      {/* Bright radial glow at the center — the flat dot-grid this replaced
          read as sunken; a lit center plus the wave strokes below is what
          the reference's "depth" actually came from. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.08) 32%, transparent 62%)',
        }}
        aria-hidden="true"
      />

      {/* Soft flowing wave strokes. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 800 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,210 C220,140 420,290 800,170" stroke="white" strokeOpacity="0.14" strokeWidth="2" fill="none" />
        <path d="M0,520 C260,450 540,610 800,500" stroke="white" strokeOpacity="0.10" strokeWidth="2" fill="none" />
        <path d="M0,830 C230,910 520,760 800,860" stroke="white" strokeOpacity="0.08" strokeWidth="2" fill="none" />
      </svg>

      {/* Large ring outlines + blue-only glow blobs, kept to the brand's own
          blue family so they read as depth rather than off-brand noise. */}
      <div
        className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full border border-white/10"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/3 -right-16 w-72 h-72 rounded-full border border-white/10"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/4 -left-24 w-80 h-80 bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl opacity-30 animate-blob"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 right-0 w-96 h-96 bg-cyan-200 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob animation-delay-2000"
        aria-hidden="true"
      />

      {/* Brand mark + pitch grouped together with a tight, fixed gap — the
          badge sits close to the logo but gets real room before the
          heading; an eyebrow label reads as a caption on the headline, not
          on the logo. */}
      <div className="relative z-10 space-y-2">
        <Logo size="lg" variant="inverted" withTagline />

        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span>Nền tảng học Tiếng Anh thông minh nhất</span>
          </div>

          <h1 className="text-5xl font-black leading-tight mb-4">
            Chinh phục <br />
            <span className="text-yellow-300">Tiếng Anh</span> <br />
            cùng trí tuệ AI
          </h1>

          <p className="text-xl text-blue-50/80 max-w-lg font-light leading-normal mb-6">
            Hệ thống học tập cá nhân hóa vượt trội, giúp bạn đạt điểm IELTS cao và giao tiếp tự nhiên như người bản xứ.
          </p>

          <div className="grid grid-cols-2 gap-5 w-full max-w-md">
            <div className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl transform hover:scale-105 transition-transform cursor-default group">
              <div className="w-10 h-10 bg-blue-400/30 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-400/50 transition-colors">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-1">Gia sư AI 24/7</h3>
              <p className="text-sm text-blue-50/70">Sửa lỗi phát âm và ngữ pháp ngay lập tức.</p>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl transform hover:scale-105 transition-transform cursor-default group">
              <div className="w-10 h-10 bg-blue-400/30 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-400/50 transition-colors">
                <Languages className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-1">Đa dạng khóa học</h3>
              <p className="text-sm text-blue-50/70">Từ mất gốc đến nâng cao, bám sát thực tế.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Social proof, pinned to the bottom via margin-top: auto. */}
      <div className="relative z-10 flex items-center gap-4 mt-auto pt-6">
        <div className="flex -space-x-2 overflow-hidden" aria-hidden="true">
          {AVATAR_PHOTOS.map((photo) => (
            <img
              key={photo}
              className="inline-block h-11 w-11 rounded-full ring-2 ring-blue-600 object-cover bg-blue-400"
              src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&q=80&w=150`}
              alt=""
              loading="lazy"
            />
          ))}
        </div>
        <div>
          <div className="flex items-center gap-1" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-sm text-blue-50/80 font-medium mt-0.5">
            <strong className="text-white">50,000+ học viên</strong> đang tin tưởng và cải thiện mỗi ngày
          </p>
        </div>
      </div>
    </div>
  );
};
