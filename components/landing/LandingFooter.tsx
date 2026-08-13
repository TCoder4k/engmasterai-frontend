import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Languages, Moon, Send, Smartphone, Sparkles } from 'lucide-react';
import { SECTION_IDS, scrollToSection } from './sections';

// Footer.
//
// Every entry points at a route this app registers, a section this page
// renders, or a mailto. The reference's "Về chúng tôi / Blog / Tuyển dụng /
// Điều khoản / Chính sách" column was replaced with account and support
// links rather than copied: those five pages do not exist, and a footer full
// of href="#" is the exact dead-affordance problem this page already fixed
// once (HomePage.test.tsx asserts it can't come back).
interface FooterLink {
  label: string;
  to?: string;
  href?: string;
}

const LEARN_LINKS: FooterLink[] = [
  { label: 'Ngữ pháp phản xạ', to: '/grammar' },
  { label: 'Từ vựng Spaced Repetition', to: '/vocab' },
  { label: 'Luyện nghe chép chính tả', to: '/practice/listening' },
  { label: 'Ôn tập hằng ngày', to: '/practice/review' },
  { label: 'Toàn bộ khóa học', to: '/courses' },
];

const PRODUCT_LINKS: FooterLink[] = [
  { label: 'Ba kỹ năng cốt lõi', href: `#${SECTION_IDS.skills}` },
  { label: 'Thử AI trực tiếp', href: `#${SECTION_IDS.demo}` },
  { label: 'Tính năng nổi bật', href: `#${SECTION_IDS.features}` },
  { label: 'Bảng giá cá nhân', href: `#${SECTION_IDS.pricing}` },
  { label: 'Đánh giá học viên', href: `#${SECTION_IDS.testimonials}` },
];

const ACCOUNT_LINKS: FooterLink[] = [
  { label: 'Câu hỏi thường gặp', href: `#${SECTION_IDS.faq}` },
  { label: 'Liên hệ hỗ trợ', href: 'mailto:support@engmaster.ai' },
  { label: 'Đăng nhập', to: '/login' },
  { label: 'Tạo tài khoản', to: '/register' },
  { label: 'Quên mật khẩu', to: '/forgot-password' },
];

const TRAITS = [
  { icon: Languages, label: 'Song ngữ Việt · Anh' },
  { icon: Moon, label: 'Giao diện sáng và tối' },
  { icon: Smartphone, label: 'Dùng tốt trên điện thoại' },
];

const LINK_CLASS =
  'hover:text-white transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

const FooterColumn: React.FC<{ id: string; title: string; links: FooterLink[] }> = ({
  id,
  title,
  links,
}) => (
  <nav aria-labelledby={id}>
    <h2 id={id} className="text-xs font-bold uppercase tracking-wider text-white mb-4">
      {title}
    </h2>
    <ul className="space-y-2.5 text-xs font-medium">
      {links.map((link) => (
        <li key={link.label}>
          {link.to ? (
            <Link to={link.to} className={LINK_CLASS}>
              {link.label}
            </Link>
          ) : (
            <a
              href={link.href}
              onClick={link.href?.startsWith('#') ? scrollToSection(link.href) : undefined}
              className={LINK_CLASS}
            >
              {link.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  </nav>
);

const LandingFooter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // Front-end only: nothing is sent anywhere and no address is stored, so
  // the field is cleared as soon as the confirmation shows.
  const handleSubscribe = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setEmail('');
    setSubscribed(true);
    window.setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer className="bg-slate-950 dark:bg-ink-950 text-slate-400 text-sm border-t border-slate-800 dark:border-ink-700 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800 dark:border-ink-700">
          <div className="lg:col-span-2 space-y-4">
            <Link
              to="/"
              className="flex items-center gap-2.5 w-fit rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="text-xl font-bold tracking-tight text-white">
                EngMaster<span className="text-blue-500">AI</span>
              </span>
            </Link>

            <p className="text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed">
              Nền tảng học tiếng Anh cá nhân hóa bằng AI thế hệ mới dành cho chuyên gia, kỹ sư và sinh
              viên Việt Nam. Tự tin giao tiếp chuẩn bản xứ.
            </p>

            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Đăng ký nhận mẹo học tiếng Anh mỗi tuần:
              </p>

              <form onSubmit={handleSubscribe} className="flex items-center gap-2 max-w-sm">
                <label htmlFor="newsletter-email" className="sr-only">
                  Email nhận bản tin
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="DuyTu@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-900 dark:bg-ink-900 border border-slate-800 dark:border-ink-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shrink-0 transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Gửi
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </form>
              <div className="flex items-center gap-2 max-w-sm mt-4">
  <a
    href="https://zalo.me/0356481406" // thay bằng số Zalo thật
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-green-400 text-white font-bold rounded-xl text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
  >
    {/* Icon Zalo có thể dùng SVG hoặc ảnh */}
    <img
      src="https://hienlaptop.com/wp-content/uploads/2024/12/logo-zalo-vector-13.jpg" // đường dẫn icon Zalo
      alt="Zalo"
      className="w-4 h-4"
    />
    Góp ý qua Zalo: 0356481406
  </a>
</div>


              <p aria-live="polite" className="min-h-[1.25rem] mt-2">
                {subscribed && (
                  <span className="text-xs font-semibold text-emerald-400">
                    ✓ Cảm ơn bạn! Đã ghi nhận đăng ký bản tin.
                  </span>
                )}
              </p>
            </div>
          </div>

          <FooterColumn id="footer-learn" title="Chương trình học" links={LEARN_LINKS} />
          <FooterColumn id="footer-product" title="Sản phẩm & dịch vụ" links={PRODUCT_LINKS} />
          <FooterColumn id="footer-account" title="Hỗ trợ & tài khoản" links={ACCOUNT_LINKS} />
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
          {/* Computed, so it cannot go stale the way a hardcoded year does. */}
          <p>© {new Date().getFullYear()} EngMasterAI. Bảo lưu mọi quyền.</p>

          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRAITS.map((trait) => {
              const Icon = trait.icon;
              return (
                <li key={trait.label} className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
                  {trait.label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
