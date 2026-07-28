import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, Menu, Sparkles, X } from 'lucide-react';
import { authService, AUTH_CHANGED_EVENT } from '../services/authService';

// Marketing header for the public landing page.
//
// Every entry points at something that exists. The previous version linked
// to `#pricing` (no pricing anywhere in this product), `#practice` and
// `#path`, and the logo was a plain <div> — three dead affordances on the
// first thing a visitor touches.
//
// In-page anchors use the section ids rendered by HomePage; the product
// links go to the real routes behind ProtectedRoute, so an anonymous click
// lands on /login and returns after sign-in.
const SECTION_LINKS = [
  { name: 'Học gì', href: '#modules' },
  { name: 'Cách hoạt động', href: '#how-it-works' },
  { name: 'Dùng thử', href: '#demo' },
];

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(() => authService.getUser());

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // A visitor who is already signed in must not be asked to sign in again.
  // authService broadcasts this event on login/logout/refresh-failure, so the
  // header follows a session that ends in another tab.
  useEffect(() => {
    const sync = () => setUser(authService.getUser());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);

  const homePath = user?.role === 'ADMIN' ? '/admin' : '/home';
  const closeMenu = () => setIsMenuOpen(false);

  return (
    // Named because the page has more than one navigation landmark (the
    // footer adds two), and unnamed duplicates are indistinguishable to a
    // screen reader.
    <nav
      aria-label="Điều hướng chính"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 dark:bg-ink-950/90 backdrop-blur-md shadow-sm dark:shadow-black/30 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between gap-4">
        {/* Logo — now a real link home. */}
        <Link
          to="/"
          className="flex items-center gap-2 group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label="EngMasterAI — trang chủ"
        >
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl transition-transform group-hover:scale-110">
            <Sparkles className="text-white w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            EngMaster<span className="text-indigo-600 dark:text-indigo-400">AI</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold text-sm transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link
              to={homePath}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-6 py-2.5 rounded-full shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <LayoutDashboard size={16} aria-hidden="true" />
              Vào học
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-6 py-2.5 rounded-full shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Tạo tài khoản
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden text-slate-900 dark:text-white p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav"
          aria-label={isMenuOpen ? 'Đóng menu' : 'Mở menu'}
        >
          {isMenuOpen ? <X size={28} aria-hidden="true" /> : <Menu size={28} aria-hidden="true" />}
        </button>
      </div>

      {isMenuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-ink-950 border-b border-slate-100 dark:border-ink-700 py-6 px-4 shadow-xl"
        >
          <div className="flex flex-col gap-2">
            {SECTION_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-slate-600 dark:text-slate-300 font-semibold py-2.5 text-lg rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                onClick={closeMenu}
              >
                {link.name}
              </a>
            ))}

            <hr className="my-3 border-slate-100 dark:border-ink-700" />

            {user ? (
              <Link
                to={homePath}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 block text-center"
                onClick={closeMenu}
              >
                Vào học
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full text-indigo-600 dark:text-indigo-300 font-bold py-3 text-center border border-indigo-100 dark:border-indigo-500/30 rounded-xl block"
                  onClick={closeMenu}
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 block text-center"
                  onClick={closeMenu}
                >
                  Tạo tài khoản
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;