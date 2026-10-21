import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from './Logo';
import { authService } from '../../services/authService';

type VerifyState =
  | 'loading'
  | 'pending'
  | 'verified'
  | 'invalid'
  | 'rate-limited'
  | 'unavailable'
  | 'network-error';

// The email link always lands here (a GET page load — safe for email
// security scanners to prefetch, since loading this page performs no state
// change by itself). This component's own script fires the actual
// state-changing POST on mount — never a bare backend GET link (see
// docs/sprints/sprint-02B-email-verification.md's Frontend Flow).
const EnvelopeIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v10A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Z"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path d="m3.5 7 8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MailIllustration = () => (
  <div className="relative flex h-[148px] w-[148px] items-center justify-center rounded-full bg-[#eaf2ff]">
    <div className="absolute -top-1 h-3 w-3 rotate-45 bg-[#2d72f6]" />
    <div className="relative h-[76px] w-[88px] rounded-md bg-gradient-to-b from-[#4c8cff] to-[#1762e8] shadow-[0_8px_16px_rgba(37,99,235,0.22)]">
      <div className="absolute inset-x-0 top-0 h-12 overflow-hidden rounded-md">
        <div className="absolute left-1/2 top-[-31px] h-[74px] w-[74px] -translate-x-1/2 rotate-45 border-[7px] border-white/90" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-11 overflow-hidden rounded-b-md">
        <div className="absolute left-1/2 bottom-[-34px] h-[74px] w-[74px] -translate-x-1/2 rotate-45 border-[7px] border-[#a9cbff]" />
      </div>
      <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[31px] font-black leading-none text-white">
        @
      </span>
    </div>
    <span className="absolute left-2 top-1/2 h-1.5 w-1.5 rounded-full bg-[#2d72f6]" />
    <span className="absolute right-2 top-1/3 h-1.5 w-1.5 rounded-full bg-[#2d72f6]" />
    <span className="absolute bottom-8 left-5 h-5 w-1 rotate-45 rounded-full bg-[#5d95ff]" />
    <span className="absolute right-5 bottom-10 h-5 w-1 -rotate-45 rounded-full bg-[#5d95ff]" />
  </div>
);

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<VerifyState>('loading');
  const [pendingEmail, setPendingEmail] = useState(
    () => (location.state as { email?: string } | null)?.email ?? '',
  );
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  // Guards against React 18 StrictMode's double-invoked effect (and any
  // other accidental re-run) firing the verify POST twice for one token.
  const attempted = useRef(false);
  const statusCheckInFlight = useRef(false);

  const mapStatusError = (err: any): VerifyState => {
    const statusCode = err?.statusCode as number | undefined;
    if (statusCode === 429) return 'rate-limited';
    if (statusCode === 503) return 'unavailable';
    if (statusCode === 400) return 'invalid';
    return 'network-error';
  };

  const checkLatestStatus = async () => {
    if (!pendingEmail || statusCheckInFlight.current) return;
    statusCheckInFlight.current = true;
    setState('loading');
    try {
      const result = await authService.getEmailVerificationStatus(pendingEmail);
      setState(result.verified ? 'verified' : 'pending');
    } catch (err: any) {
      setState(mapStatusError(err));
    } finally {
      statusCheckInFlight.current = false;
    }
  };

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = searchParams.get('token');
    if (!token) {
      if (pendingEmail) {
        void checkLatestStatus();
      } else {
        setState('pending');
      }
      return;
    }

    const run = async () => {
      try {
        const result = await authService.verifyEmail(token);
        setState(result.alreadyVerified ? 'verified' : 'verified');
        window.history.replaceState({}, '', '/verify-email');
      } catch (err: any) {
        setState(mapStatusError(err));
        window.history.replaceState({}, '', '/verify-email');
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately runs once on mount only
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(
      () => setResendCooldown((seconds) => seconds - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!pendingEmail || resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setResendMessage(null);
    try {
      const result = await authService.resendVerification(pendingEmail);
      setResendMessage(result.message);
      setResendCooldown(60);
    } catch (err: any) {
      setResendMessage(
        err?.statusCode === 429
          ? 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.'
          : 'Không thể gửi email lúc này. Vui lòng thử lại sau.',
      );
    } finally {
      setResendLoading(false);
    }
  };

  const content = (() => {
    switch (state) {
      case 'loading':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-semibold">Đang xác nhận email của bạn...</p>
          </div>
        );
      case 'verified':
        return (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-600">✓</div>
            <div className="space-y-2">
              <h1 className="text-[28px] font-extrabold tracking-tight text-[#17366f]">
                Email đã được xác thực thành công!
              </h1>
              <p className="text-[16px] font-semibold text-[#7890b6]">
                Bạn đã có thể đăng nhập vào tài khoản EngMasterAI của mình.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="flex h-[50px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#2b72f5] to-[#2168ed] text-[15px] font-extrabold text-white shadow-[0_7px_15px_rgba(37,99,235,0.18)]"
            >
              Đăng nhập ngay <span className="text-2xl font-light">→</span>
            </button>
          </div>
        );
      case 'pending':
        return (
          <div className="space-y-5">
            <MailIllustration />
            <div className="space-y-2 text-center">
              <h1 className="text-[28px] font-extrabold tracking-tight text-[#17366f]">
                Xác thực địa chỉ email của bạn
              </h1>
              <p className="text-[16px] font-semibold text-[#7890b6]">
                Chúng tôi đã gửi liên kết xác thực đến địa chỉ email sau:
              </p>
            </div>
            <div className="flex min-h-[50px] items-center gap-3 rounded-xl border border-[#d9e4f4] bg-[#f7faff] px-4 text-[#17366f]">
              <EnvelopeIcon className="h-6 w-6 shrink-0 text-[#7890b6]" />
              {isEditingEmail ? (
                <input
                  autoFocus
                  type="email"
                  value={pendingEmail}
                  onChange={(event) => setPendingEmail(event.target.value)}
                  onBlur={() => setIsEditingEmail(false)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{pendingEmail || 'Email đăng ký'}</span>
              )}
              <button
                type="button"
                onClick={() => setIsEditingEmail(true)}
                className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#2874f5] hover:text-[#1555c7]"
              >
                <span className="text-base leading-none">✎</span>
                Thay đổi
              </button>
            </div>
            <button
              type="button"
              onClick={() => void checkLatestStatus()}
              disabled={statusCheckInFlight.current}
              className="flex h-[50px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#2b72f5] to-[#2168ed] text-[15px] font-extrabold text-white shadow-[0_7px_15px_rgba(37,99,235,0.18)] transition hover:brightness-105"
            >
              Tôi đã xác thực email - Kiểm tra lại
              <span className="text-2xl font-light leading-none">↻</span>
            </button>
            <div className="text-center text-sm font-semibold text-[#7890b6]">
              Chưa nhận được email?{' '}
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={!pendingEmail || resendLoading || resendCooldown > 0}
                className="font-extrabold text-[#2874f5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendLoading ? 'Đang gửi...' : 'Gửi lại email xác thực'}
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#8ba0c1]">
              <span className="text-base">◷</span>
              Có thể gửi lại sau {resendCooldown} giây
            </div>
            {resendMessage && (
              <p className="text-center text-xs font-semibold text-[#2874f5]">{resendMessage}</p>
            )}
            <div className="flex items-center gap-3 rounded-xl bg-[#edf5ff] px-4 py-3 text-xs font-semibold text-[#5279b4]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#347ce4] font-bold text-white">i</span>
              Đừng quên kiểm tra thư mục Spam/Junk.
            </div>
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
          <div className="space-y-4 rounded-2xl bg-red-50 p-5 text-center">
            <p className="font-bold text-red-600">Không thể kiểm tra trạng thái email.</p>
            <p className="text-sm text-red-500">Vui lòng kiểm tra kết nối và thử lại.</p>
            <button
              type="button"
              onClick={() => void checkLatestStatus()}
              className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white"
            >
              Thử lại
            </button>
          </div>
        );
    }
  })();

  return (
    <div className="w-full max-w-[588px] px-3 py-5">
      <Logo />
      <div className="rounded-xl border border-[#e1eaf5] bg-white px-8 py-6 shadow-[0_12px_30px_rgba(43,82,139,0.08)] sm:px-14 sm:py-6">
        {content}
      </div>
      <div className="mt-6 text-center">
        <p className="text-sm font-bold text-[#2874f5]">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 hover:underline underline-offset-4"
          >
            <span className="text-xl font-light">←</span>
            Quay lại trang đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
};
