
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AccountLinkRequiredError, authService } from '../../services/authService';
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

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [linkEmail, setLinkEmail] = useState<string | null>(null);
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkError, setLinkError] = useState('');

  // Unlike the password-register flow below (which shows a success message
  // and delays redirecting to /login), a successful Google sign-in already
  // IS an authenticated session — enter it immediately, same as LoginForm.
  const enterSession = async (response: Awaited<ReturnType<typeof authService.googleLogin>>) => {
    authService.saveAuth(response);
    try {
      const fullProfile = await getProfile();
      authService.updateStoredUser(fullProfile);
    } catch (profileErr) {
      console.warn('Could not fetch full profile:', profileErr);
    }
    if (response.user.role === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate('/home');
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    if (isGoogleLoading) return;
    setError('');
    setIsGoogleLoading(true);
    try {
      const response = await authService.googleLogin(credential);
      await enterSession(response);
    } catch (err: any) {
      if (err instanceof AccountLinkRequiredError) {
        setPendingCredential(credential);
        setLinkEmail(err.email);
      } else {
        setError(err.message || 'Đăng ký bằng Google thất bại.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleConfirmLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCredential) return;
    setLinkError('');
    setIsGoogleLoading(true);
    try {
      const response = await authService.confirmGoogleLink(
        pendingCredential,
        linkPassword,
      );
      await enterSession(response);
    } catch (err: any) {
      setLinkError(
        err.message || 'Liên kết Google thất bại. Vui lòng kiểm tra mật khẩu.',
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const cancelGoogleLink = () => {
    setPendingCredential(null);
    setLinkEmail(null);
    setLinkPassword('');
    setLinkError('');
  };

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

        {linkEmail ? (
          <div className="p-5 my-10 bg-indigo-50/50 border-2 border-indigo-100 rounded-2xl space-y-4">
            <p className="text-sm font-semibold text-slate-700">
              Tài khoản <span className="font-black">{linkEmail}</span> đã tồn tại. Nhập mật khẩu để liên kết với Google.
            </p>
            {linkError && (
              <p className="text-red-600 text-sm font-semibold">{linkError}</p>
            )}
            <form onSubmit={handleConfirmLink} className="space-y-3">
              <input
                type="password"
                required
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                placeholder="Mật khẩu hiện tại"
                className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all font-medium"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isGoogleLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-70 transition-all"
                >
                  {isGoogleLoading ? 'Đang liên kết...' : 'Liên kết tài khoản'}
                </button>
                <button
                  type="button"
                  onClick={cancelGoogleLink}
                  className="px-5 py-3 bg-white border-2 border-slate-100 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-all"
                >
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        ) : (
          <GoogleSignInButton
            text="signup_with"
            onCredential={handleGoogleCredential}
          />
        )}

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
