import React from 'react';
import { GraduationCap, PlayCircle, RefreshCw } from 'lucide-react';

// How a lesson actually goes, described from the real flow:
// LessonPage's staged Grammar player (?stage=video -> ?stage=theory),
// the practice hub, and the backend-scheduled review session.
//
// Deliberately three steps and no numbers: there is no "học 15 phút mỗi
// ngày để giỏi sau 3 tháng" claim here, because nothing in this product
// measures that.

const STEPS = [
  {
    icon: <PlayCircle size={22} aria-hidden="true" />,
    tone: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400',
    step: 'Bước 1',
    title: 'Xem và hiểu',
    body: 'Mỗi bài bắt đầu bằng một video ngắn, kèm thẻ lý thuyết tách theo từng ý: khái niệm, công thức, ví dụ, lỗi thường gặp.',
  },
  {
    icon: <GraduationCap size={22} aria-hidden="true" />,
    tone: 'bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-400',
    step: 'Bước 2',
    title: 'Luyện lại ngay',
    body: 'Chuyển sang phần luyện tập: thẻ ghi nhớ, nghe chép chính tả hoặc trò chơi ghép từ — đủ để kiến thức vừa học không trôi đi.',
  },
  {
    icon: <RefreshCw size={22} aria-hidden="true" />,
    tone: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400',
    step: 'Bước 3',
    title: 'Ôn đúng lúc',
    body: 'Hệ thống xếp lịch ôn cho từng từ dựa trên mức độ bạn nhớ. Đến hạn, phần ôn tập sẽ xuất hiện ngay trên trang chủ của bạn.',
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="py-24 bg-white dark:bg-ink-900">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-14 space-y-4">
          <p className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase text-xs">
            Cách hoạt động
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Học → Luyện → Ôn
          </h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-lg leading-relaxed">
            Một vòng lặp đơn giản, lặp lại mỗi ngày. Bạn không cần tự nghĩ hôm nay nên học gì.
          </p>
        </div>

        <ol className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, index) => (
            <li
              key={step.step}
              className="relative bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-700 rounded-3xl p-7"
            >
              {/* The connector only makes sense when the steps sit in a row. */}
              {index < STEPS.length - 1 && (
                <span
                  className="hidden md:block absolute top-12 -right-3 w-6 h-px bg-slate-200 dark:bg-ink-700"
                  aria-hidden="true"
                />
              )}

              <div className={`${step.tone} w-12 h-12 rounded-2xl flex items-center justify-center mb-5`}>
                {step.icon}
              </div>

              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                {step.step}
              </p>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[15px]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default HowItWorks;
