import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical } from 'lucide-react';
import Navbar from './Navbar';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import AIDemo from './AIDemo';
import Footer from './Footer';

// Public landing page.
//
// The "social proof" band that used to sit above the footer was removed
// rather than restyled: it claimed "Hơn 10,000+ học viên đã tin dùng" and
// showed the Google, Facebook, YouTube and Slack logos as partners. None of
// that is true, the logos were hotlinked from Wikipedia, and implying a
// partnership with real companies is not something a redesign can make
// acceptable. It is replaced below by a plain call to action.
const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-600">
      <Navbar />

      <main className="flex-grow">
        <Hero />
        <Features />
        <HowItWorks />

        <section id="demo" className="py-24 bg-slate-50 dark:bg-ink-950">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12 space-y-4">
              {/* Named as a demo in the heading, not only in the result card:
                  services/geminiService.ts is a permanent deterministic mock
                  with no network call and no model behind it. */}
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                <FlaskConical size={13} aria-hidden="true" />
                Bản demo — phản hồi mẫu, chưa nối với AI thật
              </span>

              <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Thử công cụ kiểm tra câu
              </h2>
              <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-lg leading-relaxed">
                Nhập một câu tiếng Anh để xem cách chúng tôi trình bày phản hồi: câu sửa, giải thích,
                và một cách diễn đạt tự nhiên hơn. Tính năng chấm bằng AI vẫn đang được phát triển.
              </p>
            </div>

            <AIDemo />
          </div>
        </section>

        {/* Closing call to action. No numbers, no logos, no testimonials —
            nothing here that the product cannot back up. */}
        <section className="py-24 bg-white dark:bg-ink-900">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-100 dark:border-ink-700 bg-slate-50 dark:bg-ink-950 px-6 py-14 sm:px-12 text-center">
              <div
                className="absolute -top-24 -left-20 w-80 h-80 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-24 -right-20 w-80 h-80 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-3xl pointer-events-none"
                aria-hidden="true"
              />

              <div className="relative space-y-6">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  Bắt đầu với bài học đầu tiên
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed max-w-xl mx-auto">
                  Tạo tài khoản để mở lộ trình ngữ pháp, thư viện từ vựng và phần ôn tập hằng ngày.
                  Hiện chưa có gói trả phí — bạn dùng được toàn bộ nội dung đang có.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Link
                    to="/register"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    Tạo tài khoản miễn phí
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>

                  <Link
                    to="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 text-slate-700 dark:text-slate-200 font-bold px-8 py-4 rounded-xl transition-all hover:border-indigo-300 dark:hover:border-indigo-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    Tôi đã có tài khoản
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
