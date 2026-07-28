import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Headphones,
  Languages,
  Moon,
  RefreshCw,
  Smartphone,
} from 'lucide-react';

// What EngMasterAI actually teaches.
//
// This section used to advertise six things the product does not have —
// a 24/7 AI tutor, pronunciation scoring, speaking practice, real-world
// conversations, gamification, and cross-device progress sync. The last one
// was flatly false: lesson progress is device-local localStorage
// (services/lessonProgress.ts), so the landing page was promising the
// opposite of the documented behaviour.
//
// It now describes the three modules that exist, using the same icons and
// colours as the in-app track cards (components/user/LearningTrackCard.tsx)
// so the page and the product look like the same piece of software.

interface ModuleCard {
  icon: React.ReactNode;
  tile: string;
  title: string;
  description: string;
  points: string[];
  to: string;
  cta: string;
}

const MODULES: ModuleCard[] = [
  {
    icon: <BookOpen size={26} aria-hidden="true" />,
    tile: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400',
    title: 'Ngữ pháp',
    description:
      'Học theo lộ trình, không phải theo danh sách khóa học. Mỗi bài gồm video bài giảng và thẻ lý thuyết tách nhỏ.',
    points: ['Video bài giảng ngắn', 'Thẻ Khái niệm · Công thức · Ví dụ', 'Lỗi thường gặp và mẹo ghi nhớ'],
    to: '/grammar',
    cta: 'Xem lộ trình ngữ pháp',
  },
  {
    icon: <BookMarked size={26} aria-hidden="true" />,
    tile: 'bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-400',
    title: 'Từ vựng',
    description:
      'Thư viện từ theo chủ đề, chia thành các bộ thẻ vừa sức, kèm phát âm, ví dụ và hình ảnh minh họa.',
    points: ['Thẻ ghi nhớ (flashcards)', 'Nghe chép chính tả', 'Trò chơi ghép từ và tốc độ'],
    to: '/vocab',
    cta: 'Khám phá thư viện từ',
  },
  {
    icon: <Headphones size={26} aria-hidden="true" />,
    tile: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400',
    title: 'Nghe',
    description:
      'Bài nghe theo chủ đề với phần chuyển ngữ, giúp bạn quen dần với tốc độ nói tự nhiên.',
    points: ['Bài nghe theo cấp độ', 'Nghe lại từng đoạn', 'Ghi chú đi kèm bài'],
    to: '/practice/listening',
    cta: 'Bắt đầu luyện nghe',
  },
];

// Small, checkable facts — each one is something the app genuinely does.
const TRAITS = [
  { icon: <Languages size={15} aria-hidden="true" />, label: 'Song ngữ Việt · Anh' },
  { icon: <Moon size={15} aria-hidden="true" />, label: 'Giao diện sáng và tối' },
  { icon: <Smartphone size={15} aria-hidden="true" />, label: 'Dùng tốt trên điện thoại' },
];

const Features: React.FC = () => {
  return (
    <section id="modules" className="py-24 bg-slate-50 dark:bg-ink-950">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-14 space-y-4">
          <p className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase text-xs">
            Bạn sẽ học gì
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Ba kỹ năng, một lộ trình rõ ràng
          </h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-lg leading-relaxed">
            Ngữ pháp, từ vựng và nghe — mỗi phần có lộ trình riêng, và cùng chung một cơ chế ôn tập
            để bạn không quên những gì đã học.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES.map((module) => (
            <article
              key={module.title}
              className="group flex flex-col bg-white dark:bg-ink-900 p-7 rounded-3xl shadow-sm hover:shadow-xl dark:shadow-black/20 transition-all duration-300 hover:-translate-y-1 border border-slate-100 dark:border-ink-700"
            >
              <div
                className={`${module.tile} w-14 h-14 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
              >
                {module.icon}
              </div>

              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{module.title}</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-5">{module.description}</p>

              <ul className="space-y-2 mb-6">
                {module.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-[14px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    <span className="text-indigo-400 mt-0.5" aria-hidden="true">
                      •
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <Link
                to={module.to}
                className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:gap-2.5 transition-all rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {module.cta}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        {/* The review engine is the one genuinely distinctive thing here, and
            it is fully built (backend-scheduled SRS), so it gets its own band
            rather than being one bullet among six invented ones. */}
        <div className="mt-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 md:p-10 text-white">
          <div
            className="absolute -top-20 -right-16 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1 space-y-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-white/15 backdrop-blur">
                <RefreshCw size={13} aria-hidden="true" />
                Ôn tập ngắt quãng
              </span>
              <h3 className="text-2xl md:text-3xl font-black tracking-tight">
                Hệ thống tự nhắc bạn ôn đúng lúc sắp quên
              </h3>
              <p className="text-indigo-100 leading-relaxed max-w-2xl">
                Mỗi từ bạn học được xếp lịch ôn riêng. Từ nào bạn nhớ tốt sẽ giãn dần ra, từ nào hay
                quên sẽ quay lại sớm hơn — lịch ôn do máy chủ tính, nên bạn chỉ cần mở ứng dụng và học.
              </p>
            </div>

            <Link
              to="/practice/review"
              className="inline-flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold px-6 py-3.5 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Thử phiên ôn tập
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {TRAITS.map((trait) => (
            <li
              key={trait.label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-white dark:bg-ink-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-ink-700"
            >
              <span className="text-indigo-500 dark:text-indigo-400">{trait.icon}</span>
              {trait.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Features;
