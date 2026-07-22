import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from './Logo';
import { authService } from '../../services/authService';

type VerifyState =
  | 'loading'
  | 'success'
  | 'already-verified'
  | 'invalid'
  | 'rate-limited'
  | 'unavailable'
  | 'network-error';

// The email link always lands here (a GET page load — safe for email
// security scanners to prefetch, since loading this page performs no state
// change by itself). This component's own script fires the actual
// state-changing POST on mount — never a bare backend GET link (see
// docs/sprints/sprint-02B-email-verification.md's Frontend Flow).
export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerifyState>('loading');
  // Guards against React 18 StrictMode's double-invoked effect (and any
  // other accidental re-run) firing the verify POST twice for one token.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setState('invalid');
      return;
    }

    const run = async () => {
      try {
        const result = await authService.verifyEmail(token);
        setState(result.alreadyVerified ? 'already-verified' : 'success');
      } catch (err: any) {
        const statusCode = err?.statusCode as number | undefined;
        if (statusCode === 429) {
          setState('rate-limited');
        } else if (statusCode === 503) {
          setState('unavailable');
        } else if (statusCode === 400) {
          setState('invalid');
        } else {
          setState('network-error');
        }
      } finally {
        // Strip the token from the visible URL once the verify attempt has
        // resolved (success or failure) — it has no further use and should
        // not linger in browser history.
        navigate('/verify-email', { replace: true });
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately runs once on mount only (attempted ref guards re-entry)
  }, []);

  const content = (() => {
    switch (state) {
      case 'loading':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-semibold">Đang xác nhận email của bạn...</p>
          </div>
        );
      case 'success':
        return (
          <div className="p-5 bg-green-50 border-2 border-green-100 rounded-2xl text-center space-y-2">
            <p className="text-green-700 font-bold">Xác nhận email thành công!</p>
            <p className="text-sm text-green-600">Bạn có thể đăng nhập ngay bây giờ.</p>
          </div>
        );
      case 'already-verified':
        return (
          <div className="p-5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-center space-y-2">
            <p className="text-indigo-700 font-bold">Email của bạn đã được xác nhận trước đó.</p>
          </div>
        );
      case 'invalid':
        return (
          <div className="p-5 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-2">
            <p className="text-red-600 font-bold">Liên kết không hợp lệ hoặc đã hết hạn.</p>
            <p className="text-sm text-red-500">
              Vui lòng đăng nhập và yêu cầu gửi lại email xác nhận.
            </p>
          </div>
        );
      case 'rate-limited':
        return (
          <div className="p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-center space-y-2">
            <p className="text-amber-700 font-bold">Bạn đã thử quá nhiều lần.</p>
            <p className="text-sm text-amber-600">Vui lòng thử lại sau ít phút.</p>
          </div>
        );
      case 'unavailable':
        return (
          <div className="p-5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-center space-y-2">
            <p className="text-slate-600 font-bold">Tính năng xác nhận email hiện không khả dụng.</p>
          </div>
        );
      case 'network-error':
        return (
          <div className="p-5 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-2">
            <p className="text-red-600 font-bold">Đã xảy ra lỗi. Vui lòng thử lại.</p>
          </div>
        );
    }
  })();

  return (
    <div className="w-full max-w-md p-2">
      <Logo />
      <div className="space-y-6">
        {content}
        <p className="text-center text-slate-600 font-medium">
          <Link
            to="/login"
            className="text-indigo-600 font-black hover:underline underline-offset-4"
          >
            Về trang đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
};
