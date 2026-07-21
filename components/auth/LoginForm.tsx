
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { authService } from '../../services/authService';
import { getProfile } from '../../services/userService';

// Icon Components
const Eye = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);

const EyeOff = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
);

const Mail = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);

const Lock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
);

const User = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);

const ShieldCheck = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
);

const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
);

export enum UserRole {
  LEARNER = 'learner',
  ADMIN = 'admin'
}

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.LEARNER);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const apiRole = role === UserRole.LEARNER ? 'USER' : 'ADMIN';
      const response = await authService.login({
        email,
        password,
        role: apiRole,
      });

      authService.saveAuth(response);

      // Fetch full profile to get avatarUrl and other details (AuthResponse
      // itself doesn't carry avatarUrl). Routed through authService so
      // AUTH_CHANGED_EVENT fires for this update too, not just the initial
      // saveAuth — a raw second localStorage write here used to skip it.
      try {
        const fullProfile = await getProfile();
        authService.updateStoredUser(fullProfile);
      } catch (profileErr) {
        console.warn('Could not fetch full profile:', profileErr);
      }

      // Redirect based on role
      if (response.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/home');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-2">
      {/* Logo Section */}
      <Logo />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm font-semibold">{error}</p>
          </div>
        )}

        {/* Role Selection Label */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Bạn là ai?</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRole(UserRole.LEARNER)}
              className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 ${
                role === UserRole.LEARNER
                  ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 ring-4 ring-indigo-600/10'
                  : 'border-slate-100 bg-white hover:border-slate-200 text-slate-500'
              }`}
            >
              <User className={`w-6 h-6 mb-2 ${role === UserRole.LEARNER ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="text-sm font-bold">Học viên</span>
              {role === UserRole.LEARNER && (
                <div className="absolute top-2 right-2 p-0.5 bg-indigo-600 rounded-full">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setRole(UserRole.ADMIN)}
              className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 ${
                role === UserRole.ADMIN
                  ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 ring-4 ring-indigo-600/10'
                  : 'border-slate-100 bg-white hover:border-slate-200 text-slate-500'
              }`}
            >
              <ShieldCheck className={`w-6 h-6 mb-2 ${role === UserRole.ADMIN ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="text-sm font-bold">Quản trị</span>
              {role === UserRole.ADMIN && (
                <div className="absolute top-2 right-2 p-0.5 bg-indigo-600 rounded-full">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Input Fields */}
        <div className="space-y-4">
          <div className="group">
            <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Email hoặc Tên đăng nhập</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten-dang-nhap@gmail.com"
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>

          <div className="group">
            <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-12 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex justify-end pr-2 pt-2">
              <a href="#" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">Quên mật khẩu?</a>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="remember"
            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-all cursor-pointer"
          />
          <label htmlFor="remember" className="ml-3 text-sm font-semibold text-slate-600 cursor-pointer select-none">Ghi nhớ đăng nhập</label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="group w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-200 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span>Đăng Nhập</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t-2 border-slate-100"></span>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-slate-50 text-slate-500 font-bold uppercase tracking-widest">Hoặc</span>
          </div>
        </div>

        <button
          type="button"
          className="w-full py-4 bg-white border-2 border-slate-100 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-[0.98] shadow-sm"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
          Tiếp tục với Google
        </button>

        <p className="text-center text-slate-600 mt-10 font-medium">
          Chưa có tài khoản?{' '}
          <Link
            to="/register"
            className="text-indigo-600 font-black hover:underline underline-offset-4"
          >
            Đăng ký ngay
          </Link>
        </p>

        <div className="flex justify-center gap-6 text-xs text-slate-400 font-bold mt-12 pb-4">
          <a href="#" className="hover:text-indigo-600 transition-colors">ĐIỀU KHOẢN</a>
          <span className="opacity-30">•</span>
          <a href="#" className="hover:text-indigo-600 transition-colors">BẢO MẬT</a>
          <span className="opacity-30">•</span>
          <a href="#" className="hover:text-indigo-600 transition-colors">TRỢ GIÚP</a>
        </div>
      </form>
    </div>
  );
};
