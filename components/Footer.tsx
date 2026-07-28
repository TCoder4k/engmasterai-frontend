import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

// Footer.
//
// Every link here used to be `href="#"` — sixteen of them — advertising
// products that do not exist (luyện phát âm, từ điển thông minh, thi thử
// IELTS/TOEIC), a help centre and a community that were never built, and
// App Store / Play Store buttons for apps that do not exist, with the badge
// images hotlinked from Wikipedia.
//
// What remains links somewhere real. Sections that would need a page nobody
// has written are simply absent — the same rule the rest of this codebase
// follows: where there is nothing behind it, render nothing.

const LEARN_LINKS = [
  { label: 'Ngữ pháp', to: '/grammar' },
  { label: 'Từ vựng', to: '/vocab' },
  { label: 'Luyện nghe', to: '/practice/listening' },
  { label: 'Ôn tập hằng ngày', to: '/practice/review' },
];

const ACCOUNT_LINKS = [
  { label: 'Đăng nhập', to: '/login' },
  { label: 'Tạo tài khoản', to: '/register' },
  { label: 'Quên mật khẩu', to: '/forgot-password' },
];

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-ink-950 border-t border-slate-100 dark:border-ink-700 pt-16 pb-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="space-y-5 lg:col-span-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl">
                <Sparkles className="text-white w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                EngMaster<span className="text-indigo-600 dark:text-indigo-400">AI</span>
              </span>
            </Link>

            <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
              Nền tảng học tiếng Anh cho người mới bắt đầu và người luyện thi TOEIC, xây dựng quanh ba
              phần: ngữ pháp, từ vựng và nghe — cùng một cơ chế ôn tập ngắt quãng.
            </p>
          </div>

          <nav aria-labelledby="footer-learn">
            <h2
              id="footer-learn"
              className="font-black text-slate-900 dark:text-white mb-5 uppercase text-xs tracking-widest"
            >
              Học
            </h2>
            <ul className="space-y-3 text-slate-500 dark:text-slate-400 font-medium">
              {LEARN_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-account">
            <h2
              id="footer-account"
              className="font-black text-slate-900 dark:text-white mb-5 uppercase text-xs tracking-widest"
            >
              Tài khoản
            </h2>
            <ul className="space-y-3 text-slate-500 dark:text-slate-400 font-medium">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="pt-8 border-t border-slate-100 dark:border-ink-700 text-slate-400 dark:text-slate-500 text-sm font-medium">
          {/* Computed, so it cannot go stale the way the hardcoded 2024 did. */}
          <p>© {new Date().getFullYear()} EngMasterAI.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
