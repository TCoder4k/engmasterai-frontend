import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  CheckCircle,
  Mic,
  Play,
  Sparkles,
  Star,
  TrendingUp,
  Volume2,
} from 'lucide-react';
import { DURATION, EASE } from '../shared/motion';
import { SECTION_IDS, scrollToSection } from './sections';

// Twelve waveform bars. The heights are fixed so the shape is stable
// between renders; only the animation runs.
const WAVE_HEIGHTS = [40, 75, 50, 90, 100, 60, 85, 45, 70, 95, 30, 80];

const Hero: React.FC = () => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const stopTimer = useRef<number | null>(null);

  // The mock playback stops itself after 3s. Tracked in a ref and cleared on
  // unmount so a visitor who navigates away mid-"playback" doesn't leave a
  // timer writing to an unmounted component.
  useEffect(() => () => {
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
  }, []);

  const toggleAudio = () => {
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
    setIsPlayingAudio((playing) => {
      if (playing) return false;
      stopTimer.current = window.setTimeout(() => setIsPlayingAudio(false), 3000);
      return true;
    });
  };

  return (
    <section className="landing-radial relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
      <div
        className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-40 right-10 w-[300px] h-[300px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Headline column */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200/90 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 text-xs font-bold uppercase tracking-wide mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" aria-hidden="true" />
              Nền Tảng Học Tiếng Anh AI Thế Hệ Mới
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-[52px] font-black text-slate-900 dark:text-white tracking-tight leading-[1.18] sm:leading-[1.14]"
            >
              <div>Bứt phá rào cản ngôn ngữ</div>
              <div className="text-blue-600 dark:text-blue-400 mt-1 sm:mt-2">
                Làm chủ giao tiếp{' '}
                <span className="relative inline-block">
                  tự nhiên
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-blue-300 dark:text-blue-500/50 pointer-events-none"
                    viewBox="0 0 200 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M2 9C50 3 150 2 198 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE, delay: 0.2 }}
              className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed mt-6 mb-8 max-w-2xl font-normal"
            >
              Hệ thống AI nhận diện giọng nói và phân tích ngữ cảnh theo thời gian thực. Giúp bạn sửa
              lỗi phát âm, phản xạ ngữ pháp và nâng cao khả năng giao tiếp công sở tự nhiên như người
              bản xứ.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto"
            >
              <Link
                to="/register"
                className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-base font-bold rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Bắt đầu học miễn phí
                <ArrowRight
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                />
              </Link>

              <a
                href={`#${SECTION_IDS.demo}`}
                onClick={scrollToSection(`#${SECTION_IDS.demo}`)}
                className="px-6 py-3.5 bg-white dark:bg-ink-900 hover:bg-slate-50 dark:hover:bg-ink-850 border border-slate-200 dark:border-ink-700 text-slate-800 dark:text-slate-100 text-base font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Play className="w-4 h-4 fill-blue-600 text-blue-600" aria-hidden="true" />
                Xem demo tương tác
              </a>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.slow, ease: EASE, delay: 0.4 }}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400"
            >
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                Không cần thẻ tín dụng
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                Dùng thử toàn bộ 14 ngày
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                Cam kết tiến bộ rõ rệt
              </li>
            </motion.ul>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE, delay: 0.5 }}
              className="mt-10 pt-6 border-t border-slate-200/80 dark:border-ink-700 flex items-center gap-4"
            >
              <div className="flex -space-x-2 overflow-hidden" aria-hidden="true">
                {[
                  'photo-1534528741775-53994a69daeb',
                  'photo-1507003211169-0a1dd7228f2d',
                  'photo-1573496359142-b8d87734a5a2',
                  'photo-1500648767791-00dcc994a43e',
                ].map((photo) => (
                  <img
                    key={photo}
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-ink-900 object-cover bg-slate-100"
                    src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&q=80&w=150`}
                    alt=""
                    loading="lazy"
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                  ))}
                  <span className="ml-1 font-bold text-slate-900 dark:text-white text-sm">4.9/5.0</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Hơn <strong className="text-slate-800 dark:text-slate-200">50,000+ học viên</strong>{' '}
                  nâng band điểm &amp; phản xạ giao tiếp
                </p>
              </div>
            </motion.div>
          </div>

          {/* Product showcase column */}
          <div className="lg:col-span-5 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
              className="relative mx-auto max-w-md lg:max-w-none rounded-3xl bg-white dark:bg-ink-900 p-4 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-ink-700"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-ink-700">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400" aria-hidden="true" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" aria-hidden="true" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                    AI Live Voice Practice
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" aria-hidden="true" />
                  Trực tuyến
                </span>
              </div>

              <div className="mt-4 relative rounded-2xl overflow-hidden bg-slate-950 p-6 text-white min-h-[340px] flex flex-col justify-between">
                <div className="absolute inset-0 landing-grid-pattern opacity-40" aria-hidden="true" />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-xs font-medium text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-300" aria-hidden="true" />
                    Lộ trình: Business English B2
                  </span>
                  <span className="text-xs text-blue-300 font-mono">Session #14</span>
                </div>

                <div className="relative z-10 my-6 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 border border-blue-400/30 backdrop-blur-md mb-3">
                    <Mic className="w-8 h-8 text-blue-400" aria-hidden="true" />
                  </div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
                    Đang phân tích phát âm
                  </p>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    &ldquo;I am writing to inquire about...&rdquo;
                  </h2>

                  <div className="flex items-end justify-center gap-1.5 mt-4 h-8" aria-hidden="true">
                    {WAVE_HEIGHTS.map((height, index) => (
                      <span
                        key={index}
                        className={`w-1.5 bg-blue-400 rounded-full transition-all duration-300 ${
                          isPlayingAudio ? 'landing-wave-bar' : ''
                        }`}
                        style={{
                          height: `${isPlayingAudio ? height : 35}%`,
                          ['--wave-delay' as string]: `${index * 0.08}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={toggleAudio}
                    aria-pressed={isPlayingAudio}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md flex items-center gap-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                    {isPlayingAudio ? 'Đang phát mẫu...' : 'Nghe phát âm chuẩn'}
                  </button>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">
                      Độ chính xác
                    </span>
                    <span className="text-emerald-400 font-extrabold text-sm">96.8% - Xuất sắc</span>
                  </div>
                </div>
              </div>

              {/* Floating badges. Infinite drift, so they are decorative and
                  hidden from assistive tech — the numbers they show also
                  appear as real copy elsewhere on the page. */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                aria-hidden="true"
                className="absolute -top-4 -left-4 bg-white dark:bg-ink-900 p-3.5 rounded-2xl shadow-xl border border-slate-100 dark:border-ink-700 flex items-center gap-3"
              >
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 block">
                    Mục Tiêu
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    +20 Từ mới/ngày
                  </span>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
                aria-hidden="true"
                className="absolute -bottom-5 -right-4 bg-white dark:bg-ink-900 p-3.5 rounded-2xl shadow-xl border border-slate-100 dark:border-ink-700 flex items-center gap-3"
              >
                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 block">
                    Gợi ý ngữ cảnh
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Chuẩn giọng Anh - Mỹ
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
