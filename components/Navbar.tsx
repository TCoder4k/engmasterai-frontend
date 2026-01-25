
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Sparkles } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Trang chủ', href: '#' },
    { name: 'Lộ trình học', href: '#path' },
    { name: 'Luyện tập AI', href: '#practice' },
    { name: 'Bảng giá', href: '#pricing' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
    }`}>
      <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="bg-indigo-600 p-2 rounded-xl transition-transform group-hover:scale-110">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold font-display tracking-tight text-slate-900">
            EngMaster<span className="text-indigo-600">AI</span>
          </span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              className="text-slate-600 hover:text-indigo-600 font-medium transition-colors text-sm lg:text-base"
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="text-slate-600 hover:text-indigo-600 font-semibold px-4 py-2 transition-colors">
            Đăng nhập
          </Link>
          <Link to="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-full shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5 active:translate-y-0">
            Đăng ký miễn phí
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-slate-900" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-100 py-6 px-4 shadow-xl animate-in slide-in-from-top-4">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                className="text-slate-600 font-medium py-2 text-lg"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <hr className="my-2 border-slate-100" />
            <Link to="/login" className="w-full text-indigo-600 font-semibold py-3 text-center border border-indigo-100 rounded-xl block" onClick={() => setIsMenuOpen(false)}>
              Đăng nhập
            </Link>
            <Link to="/register" className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-100 block text-center" onClick={() => setIsMenuOpen(false)}>
              Đăng ký miễn phí
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
