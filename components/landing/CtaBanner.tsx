import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { RevealOnScroll } from '../shared/motion';

const CtaBanner: React.FC = () => {
  return (
    <section className="py-20 bg-slate-900 dark:bg-ink-950 relative overflow-hidden text-white">
      <div
        className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <RevealOnScroll className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
          Bắt đầu hành trình bứt phá ngay hôm nay
        </span>

        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6 max-w-3xl mx-auto">
          Sẵn sàng làm chủ tiếng Anh cùng người đồng hành AI 24/7?
        </h2>

        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          Tạo tài khoản miễn phí trong 30 giây. Không cần thẻ tín dụng, trải nghiệm toàn bộ lộ trình
          phản xạ tự nhiên ngay lập tức.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link
            to="/register"
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-extrabold text-base rounded-xl shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Bắt đầu học miễn phí ngay
            <ArrowRight
              className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              aria-hidden="true"
            />
          </Link>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-400">
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            Miễn phí 100% khi bắt đầu
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            Hủy bất kỳ lúc nào
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" aria-hidden="true" />
            Cam kết hiệu quả
          </li>
        </ul>
      </RevealOnScroll>
    </section>
  );
};

export default CtaBanner;
