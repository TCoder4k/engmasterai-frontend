import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from './Logo';
import { authService } from '../../services/authService';

// The token arrives via query parameter and is never written to
// localStorage/sessionStorage. Unlike VerifyEmailPage, page load itself is
// side-effect-free — the actual POST /auth/password/reset only fires when
// the user submits the form below (the two-field form is already a natural
// human-in-the-loop gate, so there's no scanner-prefetch concern to design
// around here — see docs/sprints/sprint-02C-password-recovery.md's
// Frontend Flow).
export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !token) return; // duplicate-submit guard
    setError('');

    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, newPassword);
      setSuccess(true);
      // Token has no further use once consumed — strip it from the visible
      // URL/history, same convention as VerifyEmailPage.
      navigate('/reset-password', { replace: true });
    } catch (err: any) {
      const statusCode = err?.statusCode as number | undefined;
      const code = err?.code as string | undefined;
      if (statusCode === 409 && code === 'PASSWORD_REUSE') {
        // The token is deliberately NOT consumed on this branch (backend
        // contract — see AuthService.resetPassword()) — the user can retry
        // immediately with a different password using the same link.
        setError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
        setNewPassword('');
        setConfirmPassword('');
      } else if (statusCode === 400) {
        setLinkInvalid(true);
      } else if (statusCode === 429) {
        setError('Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.');
      } else if (statusCode === 503) {
        setError('Tính năng đặt lại mật khẩu hiện không khả dụng.');
      } else {
        setError('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkInvalid) {
    return (
      <div className="w-full max-w-md p-2">
        <Logo />
        <div className="space-y-6">
          <div className="p-5 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-2">
            <p className="text-red-600 font-bold">Liên kết không hợp lệ hoặc đã hết hạn.</p>
            <p className="text-sm text-red-500">Vui lòng yêu cầu một liên kết đặt lại mật khẩu mới.</p>
          </div>
          <p className="text-center text-slate-600 font-medium">
            <Link to="/forgot-password" className="text-indigo-600 font-black hover:underline underline-offset-4">
              Yêu cầu liên kết mới
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md p-2">
        <Logo />
        <div className="space-y-6">
          <div className="p-5 bg-green-50 border-2 border-green-100 rounded-2xl text-center space-y-2">
            <p className="text-green-700 font-bold">Đặt lại mật khẩu thành công!</p>
            <p className="text-sm text-green-600">Vui lòng đăng nhập lại bằng mật khẩu mới.</p>
          </div>
          <p className="text-center text-slate-600 font-medium">
            <Link to="/login" className="text-indigo-600 font-black hover:underline underline-offset-4">
              Về trang đăng nhập
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-2">
      <Logo />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-800">Đặt lại mật khẩu</h1>
          <p className="text-sm text-slate-500 font-medium">Nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p role="alert" className="text-red-600 text-sm font-semibold">{error}</p>
          </div>
        )}

        <div className="group">
          <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Mật khẩu mới</label>
          <input
            type="password"
            required
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="group">
          <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Xác nhận mật khẩu mới</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-200 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <span>Đặt lại mật khẩu</span>
          )}
        </button>
      </form>
    </div>
  );
};
