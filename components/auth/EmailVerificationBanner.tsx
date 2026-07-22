import React, { useEffect, useState } from 'react';
import { AUTH_CHANGED_EVENT, authService } from '../../services/authService';

// Self-hiding banner shown while the authenticated user's email is
// unverified (Sprint 02B). Renders nothing once verified/absent — reads
// authService.getUser() on mount and re-checks on every AUTH_CHANGED_EVENT,
// the same reactive pattern ThemeProvider already uses, so it disappears
// without a full page reload once the stored user reflects verification.
export const EmailVerificationBanner: React.FC = () => {
  const [emailVerified, setEmailVerified] = useState<boolean>(
    () => authService.getUser()?.emailVerified ?? true,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const onAuthChanged = () =>
      setEmailVerified(authService.getUser()?.emailVerified ?? true);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
  }, []);

  if (emailVerified) return null;

  const handleResend = async () => {
    if (isLoading) return; // duplicate-click prevention, same convention used throughout this app
    setIsLoading(true);
    setResult(null);
    try {
      const response = await authService.resendVerification();
      setResult({
        text: response.delivered === false
          ? 'Chưa gửi được email. Vui lòng thử lại sau ít phút.'
          : response.message,
        ok: response.delivered !== false,
      });
    } catch (err: any) {
      setResult({ text: err?.message || 'Không thể gửi email xác nhận.', ok: false });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-amber-50 border-b-2 border-amber-200 px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-amber-800">
          Vui lòng xác nhận địa chỉ email của bạn để bảo mật tài khoản.
        </p>
        <div className="flex items-center gap-3">
          {result && (
            <span className={`text-xs font-semibold ${result.ok ? 'text-amber-700' : 'text-red-600'}`}>
              {result.text}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={isLoading}
            className="text-sm font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-xl disabled:opacity-60 transition-all"
          >
            {isLoading ? 'Đang gửi...' : 'Gửi lại email xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
};
