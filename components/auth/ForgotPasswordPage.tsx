import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { authService } from '../../services/authService';

type PageState = 'form' | 'submitting' | 'sent' | 'rate-limited' | 'unavailable' | 'network-error';

// The backend's response is deliberately identical (the same generic
// message) whether the submitted email belongs to a real account, a
// Google-only account, or no account at all — see docs/sprints/
// sprint-02C-password-recovery.md's "Endpoint Contracts". This page must
// never try to distinguish those cases either; 'sent' is the one success
// state for every well-formed submission. Only genuinely different backend
// signals (429, 503, a network failure) get their own state here.
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<PageState>('form');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'submitting') return; // duplicate-submit guard
    setState('submitting');

    try {
      await authService.forgotPassword(email);
      setState('sent');
    } catch (err: any) {
      const statusCode = err?.statusCode as number | undefined;
      if (statusCode === 429) {
        setState('rate-limited');
      } else if (statusCode === 503) {
        setState('unavailable');
      } else if (statusCode === 400) {
        // Malformed email the browser's own type="email" validation missed
        // (or a server-side-only rule) — let the user correct it and retry.
        setState('form');
      } else {
        setState('network-error');
      }
    }
  };

  if (state === 'sent') {
    return (
      <div className="w-full max-w-md p-2">
        <Logo />
        <div className="space-y-6">
          <div className="p-5 bg-green-50 border-2 border-green-100 rounded-2xl text-center space-y-2">
            <p className="text-green-700 font-bold">Nếu tài khoản tồn tại, chúng tôi đã gửi email đặt lại mật khẩu.</p>
            <p className="text-sm text-green-600">Vui lòng kiểm tra hộp thư đến (và cả mục spam).</p>
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
          <h1 className="text-xl font-black text-slate-800">Quên mật khẩu?</h1>
          <p className="text-sm text-slate-500 font-medium">
            Nhập email của bạn, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
          </p>
        </div>

        {state === 'rate-limited' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p role="alert" className="text-amber-700 text-sm font-semibold">
              Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.
            </p>
          </div>
        )}
        {state === 'unavailable' && (
          <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl">
            <p role="alert" className="text-slate-600 text-sm font-semibold">
              Tính năng đặt lại mật khẩu hiện không khả dụng.
            </p>
          </div>
        )}
        {state === 'network-error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p role="alert" className="text-red-600 text-sm font-semibold">
              Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.
            </p>
          </div>
        )}

        <div className="group">
          <label className="text-sm font-bold text-slate-700 mb-2 block ml-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten-dang-nhap@gmail.com"
            className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={state === 'submitting'}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-200 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state === 'submitting' ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <span>Gửi liên kết đặt lại mật khẩu</span>
          )}
        </button>

        <p className="text-center text-slate-600 font-medium">
          <Link to="/login" className="text-indigo-600 font-black hover:underline underline-offset-4">
            Về trang đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
};
