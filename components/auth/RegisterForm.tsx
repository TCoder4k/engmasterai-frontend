
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';
import { authService } from '../../services/authService';
import { getProfile } from '../../services/userService';

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password match
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.register({
        name,
        email,
        password,
      });

      // Save auth response
      authService.saveAuth(response);

      // Fetch full profile to get avatarUrl and other details — routed
      // through authService so AUTH_CHANGED_EVENT fires for this update too
      // (see the matching note in LoginForm.tsx).
      try {
        const fullProfile = await getProfile();
        authService.updateStoredUser(fullProfile);
      } catch (profileErr) {
        console.warn('Could not fetch full profile:', profileErr);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors)) {
        setError(err.errors.map((e: any) => e.message).join(', '));
      } else {
        setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-2">
      {/* Logo Section */}
      <Logo />
      
      <div className="text-center mb-8">
        <p className="text-slate-500 font-bold">Tham gia cùng hàng nghìn học viên tại EngMasterAI</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-600 text-sm font-semibold">Đăng ký thành công! Đang chuyển đến trang đăng nhập...</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm font-semibold">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="group">
            <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Họ và tên</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>

          <div className="group">
            <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Địa chỉ Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
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
                minLength={6}
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
          </div>

          <div className="group">
            <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Xác nhận mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
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
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-1 relative">
              <input
                type="checkbox"
                required
                className="peer h-5 w-5 appearance-none rounded-lg border-2 border-slate-200 checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer"
              />
              <CheckCircle2 className="absolute top-0 left-0 w-5 h-5 text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none p-0.5" />
            </div>
            <span className="text-sm font-semibold text-slate-600 leading-snug">
              Tôi đồng ý với <a href="#" className="text-indigo-600 font-black hover:underline">Điều khoản</a> và <a href="#" className="text-indigo-600 font-black hover:underline">Chính sách bảo mật</a>.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 transform transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isLoading ? (
             <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : 'ĐĂNG KÝ NGAY'}
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
          Đăng ký bằng Google
        </button>

        <p className="text-center text-slate-600 mt-10 font-medium">
          Đã có tài khoản?{' '}
          <Link
            to="/login"
            className="text-indigo-600 font-black hover:underline underline-offset-4"
          >
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
};
