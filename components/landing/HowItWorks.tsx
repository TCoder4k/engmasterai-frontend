import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle, PlayCircle, RotateCcw } from 'lucide-react';
import { RevealOnScroll, STAGGER_STEP } from '../shared/motion';
import { SECTION_IDS } from './sections';

const STEPS = [
  {
    stepNumber: 'BƯỚC 1',
    title: 'Xem và hiểu',
    icon: PlayCircle,
    iconColor:
      'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
    description:
      'Mỗi bài bắt đầu bằng một video giảng ngắn 3-5 phút, kèm thẻ lý thuyết tách nhỏ theo từng ý: khái niệm, công thức, ví dụ thực tế và các lỗi sai thường gặp.',
  },
  {
    stepNumber: 'BƯỚC 2',
    title: 'Luyện lại ngay',
    icon: RotateCcw,
    iconColor:
      'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30',
    description:
      'Chuyển sang phần luyện phản xạ trực tiếp: thẻ ghi nhớ Flashcards đa giác quan, nghe chép chính tả thông minh hoặc hội thoại tương tác với AI.',
  },
  {
    stepNumber: 'BƯỚC 3',
    title: 'Ôn đúng lúc sắp quên',
    icon: Calendar,
    iconColor:
      'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
    description:
      'Hệ thống tự động tính toán đường cong quên (Forgetting Curve) để xếp lịch ôn cho từng từ. Đến hạn, phần ôn tập sẽ tự xuất hiện ngay trên trang chủ.',
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section
      id={SECTION_IDS.howItWorks}
      className="scroll-mt-24 py-20 lg:py-28 bg-slate-50/60 dark:bg-ink-950 border-t border-slate-200/60 dark:border-ink-700"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/30">
            Cách hoạt động
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-4 mb-4">
            Học <span className="text-blue-600 dark:text-blue-400">→</span> Luyện{' '}
            <span className="text-blue-600 dark:text-blue-400">→</span> Ôn
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Một vòng lặp khép kín đơn giản, duy trì mỗi ngày. Bạn không cần lo lắng hôm nay phải học
            gì — hệ thống sẽ chuẩn bị lộ trình tối ưu sẵn cho bạn.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <RevealOnScroll
                key={step.stepNumber}
                as="li"
                delay={index * (STAGGER_STEP * 2)}
                className="bg-white dark:bg-ink-900 p-8 rounded-3xl border border-slate-200/90 dark:border-ink-700 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-500/50 hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className={`p-3 rounded-2xl border ${step.iconColor}`}>
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-mono font-extrabold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-ink-800 px-3 py-1 rounded-full">
                      {step.stepNumber}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <p className="mt-6 pt-4 border-t border-slate-100 dark:border-ink-700 flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <CheckCircle className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  Tự động tối ưu hóa
                </p>
              </RevealOnScroll>
            );
          })}
        </ol>

        <RevealOnScroll className="relative rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-8 sm:p-12 text-white shadow-2xl overflow-hidden">
          <div
            className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-blue-100 mb-4">
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Thuật toán Ôn tập ngắt quãng (Spaced Repetition)
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
                Hệ thống tự động nhắc bạn ôn đúng thời điểm bộ não sắp quên
              </h3>
              <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
                Mỗi từ vựng bạn học được xếp lịch ôn riêng. Từ nào nhớ tốt sẽ giãn dần khoảng cách, từ
                nào hay quên sẽ quay lại sớm hơn — lịch ôn hoàn toàn do máy chủ tính toán.
              </p>
            </div>

            <Link
              to="/practice/review"
              className="shrink-0 w-full lg:w-auto px-7 py-4 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Thử phiên ôn tập
              <ArrowRight
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
};

export default HowItWorks;
