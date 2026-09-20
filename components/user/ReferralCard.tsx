import React, { useEffect, useState } from 'react';
import { Check, Copy, Gift, User } from 'lucide-react';
import { ApiError } from '../../services/apiError';
import { getMyReferralCode, redeemReferralCode } from '../../services/referralService';

// 2026-09-16 pricing relaunch (Phase C) — "Mời một người bạn học thật — cả
// hai nhận 3 ngày PRO". Standalone referral card in the 40% right column.
const ReferralCard: React.FC = () => {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getMyReferralCode()
      .then((result) => setCode(result.code))
      .catch(() => {
        // Best-effort — the card simply shows nothing to copy.
      });
  }, []);

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied/unavailable — the code stays visible and selectable.
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = redeemInput.trim();
    if (!trimmed || isRedeeming) return;
    setIsRedeeming(true);
    setRedeemMessage(null);
    try {
      await redeemReferralCode(trimmed);
      setRedeemMessage({
        text: 'Đã áp dụng mã! Khi bạn của bạn bắt đầu học, cả hai sẽ nhận 3 ngày PRO.',
        ok: true,
      });
      setRedeemInput('');
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 400
          ? 'Bạn không thể dùng mã giới thiệu của chính mình.'
          : err instanceof ApiError && err.status === 404
            ? 'Không tìm thấy mã giới thiệu này.'
            : err instanceof ApiError && err.status === 409
              ? 'Bạn đã sử dụng một mã giới thiệu trước đó rồi.'
              : 'Không thể áp dụng mã này. Vui lòng thử lại.';
      setRedeemMessage({ text: message, ok: false });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <aside className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div>
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <Gift className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Mời bạn học cùng
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Mời thêm người bạn học thật — cả hai nhận 3 ngày PRO miễn phí khi bạn của bạn bắt đầu học.
            </p>
          </div>
        </div>

        {/* Referral Form Controls */}
        <div className="mt-8 space-y-6">
          {/* My referral code */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-900">
              MÃ CỦA BẠN
            </label>
            <div className="mt-2 flex gap-3">
              <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-900">
                <User className="h-5 w-5 text-slate-400 shrink-0" />
                <span className="font-mono text-sm font-semibold truncate">
                  {code ?? '...'}
                </span>
              </div>
              <button
                type="button"
                onClick={copyCode}
                disabled={!code}
                className="flex shrink-0 items-center gap-2 px-3 font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>
          </div>

          {/* Friend code input */}
          <div>
            <label htmlFor="friend-code" className="text-xs font-semibold uppercase tracking-wide text-slate-900">
              CÓ MÃ CỦA BẠN BÈ?
            </label>
            <form onSubmit={handleRedeem} className="mt-2 flex flex-col sm:flex-row gap-3">
              <input
                id="friend-code"
                type="text"
                value={redeemInput}
                onChange={(e) => setRedeemInput(e.target.value)}
                placeholder="Nhập mã giới thiệu"
                className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
              <button
                type="submit"
                disabled={isRedeeming || redeemInput.trim().length === 0}
                className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-500 hover:bg-violet-600 px-5 font-semibold text-white transition active:scale-95 disabled:opacity-50"
              >
                <Gift className="h-4 w-4" />
                <span>{isRedeeming ? 'Đang xử lý...' : 'Dùng mã'}</span>
              </button>
            </form>
            {redeemMessage && (
              <p
                role="alert"
                className={`mt-2 text-xs font-semibold ${
                  redeemMessage.ok ? 'text-emerald-600' : 'text-rose-500'
                }`}
              >
                {redeemMessage.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Referral Benefits Info Card */}
      <div className="mt-8 rounded-2xl bg-gradient-to-br from-violet-50/70 via-slate-50/40 to-blue-50/50 p-5 border border-violet-100/70">
        <h3 className="font-bold text-slate-900 text-base">
          Học cùng bạn bè vui hơn mỗi ngày!
        </h3>
        <ul className="mt-3 space-y-2 text-xs sm:text-sm text-slate-600 font-medium">
          <li className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
              <Check size={11} strokeWidth={3} />
            </span>
            <span>Nhận 3 ngày PRO miễn phí</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
              <Check size={11} strokeWidth={3} />
            </span>
            <span>Cùng nhau tiến bộ nhanh hơn</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
              <Check size={11} strokeWidth={3} />
            </span>
            <span>Khám phá nhiều tính năng cao cấp</span>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default ReferralCard;
