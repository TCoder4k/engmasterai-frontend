import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Globe, LayoutDashboard, Menu, X } from 'lucide-react';
import { authService, AUTH_CHANGED_EVENT } from '../../services/authService';
import { DURATION, EASE } from '../shared/motion';
import { Logo } from '../shared/Logo';
import { SECTION_LINKS, scrollToSection } from './sections';

// Marketing header: transparent over the hero, frosted once scrolled.
//
// Every destination is real. The section links point at ids this page
// actually renders, and the account buttons go to the live /login and
// /register routes rather than a modal that fakes a signup — a visitor who
// clicks "Tạo tài khoản" gets an account.
const LandingHeader: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(() => authService.getUser());

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // A visitor who is already signed in must not be asked to sign in again.
  // authService broadcasts this on login/logout/refresh-failure, so the
  // header follows a session that ends in another tab.
  useEffect(() => {
    const sync = () => setUser(authService.getUser());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);

  const homePath = user?.role === 'ADMIN' ? '/admin' : '/home';

  return (
    <nav
      // Named because this page has more than one navigation landmark (the
      // footer adds three), and unnamed duplicates are indistinguishable to
      // a screen reader.
      aria-label="Điều hướng chính"
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'landing-glass shadow-sm border-b border-slate-200/80 dark:border-ink-700 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="EngMasterAI — trang chủ"
          >
            <Logo size="md">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase mt-0.5">
                Global Learning
              </span>
            </Logo>
          </Link>

          <div className="hidden md:flex items-center gap-1 lg:gap-2 bg-slate-100/70 dark:bg-ink-900/70 p-1.5 rounded-full border border-slate-200/70 dark:border-ink-700 backdrop-blur-sm">
            {SECTION_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={scrollToSection(link.href)}
                className="px-3.5 py-1.5 text-xs lg:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-ink-800 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              VIE
            </span>

            {user ? (
              <Link
                to={homePath}
                className="px-4 py-2.5 text-xs lg:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <LayoutDashboard size={15} aria-hidden="true" />
                Vào học
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs lg:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2.5 text-xs lg:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Tạo tài khoản
                  <ArrowRight
                    className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                    aria-hidden="true"
                  />
                </Link>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <Link
              to={user ? homePath : '/register'}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {user ? 'Vào học' : 'Học thử'}
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="p-2 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-ink-800 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-nav"
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobileMenuOpen && (
          <motion.div
            id="landing-mobile-nav"
            key="mobile-nav"
            // Height only: an opacity-0 start would leave the menu
            // genuinely invisible for anyone whose animations never run.
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="md:hidden overflow-hidden bg-white/95 dark:bg-ink-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-ink-700 shadow-xl"
          >
            <div className="px-4 pt-3 pb-6">
              <div className="flex flex-col gap-2 mb-4">
                {SECTION_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(event) => {
                      setMobileMenuOpen(false);
                      scrollToSection(link.href)(event);
                    }}
                    className="px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-ink-900 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {link.name}
                  </a>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-ink-700 flex flex-col gap-2">
                {user ? (
                  <Link
                    to={homePath}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-md text-center"
                  >
                    Vào học
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-ink-700 rounded-xl hover:bg-slate-50 dark:hover:bg-ink-900 text-center"
                    >
                      Đăng nhập
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-md text-center flex items-center justify-center gap-2"
                    >
                      Bắt đầu học miễn phí
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default LandingHeader;
