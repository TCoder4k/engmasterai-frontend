import React, { useEffect, useState } from 'react';
import { Check, Copy, Gift, Users } from 'lucide-react';
import { ApiError } from '../../services/apiError';
import { getMyReferralCode, redeemReferralCode } from '../../services/referralService';

// 2026-09-16 pricing relaunch (Phase C) — "Mời một người bạn học thật → cả
// hai nhận 3 ngày PRO". A standalone card, not wired into any other flow —
// students find it on their Profile page. Self-contained: fetches its own
// code on mount, best-effort (renders a loading placeholder, never blocks
// the rest of the Profile page on failure).
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
    <div className="mt-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          <Gift size={17} aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Mời bạn học cùng</h2>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Mời một người bạn học thật — cả hai nhận <strong>3 ngày PRO</strong> miễn phí khi bạn của bạn bắt đầu học.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
            Mã của bạn
          </label>
          <div className="flex items-center gap-2">
            <span className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white">
              {code ?? '...'}
            </span>
            <button
              type="button"
              onClick={copyCode}
              disabled={!code}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? 'Đã chép' : 'Sao chép'}
            </button>
          </div>
        </div>

        <form onSubmit={handleRedeem} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="redeem-code" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Có mã của bạn bè?
            </label>
            <input
              id="redeem-code"
              type="text"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value)}
              placeholder="Nhập mã giới thiệu"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            type="submit"
            disabled={isRedeeming || redeemInput.trim().length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Users size={15} aria-hidden="true" />
            {isRedeeming ? 'Đang xử lý...' : 'Dùng mã'}
          </button>
        </form>
        {redeemMessage && (
          <p
            role="alert"
            className={`text-xs font-semibold ${redeemMessage.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}
          >
            {redeemMessage.text}
          </p>
        )}
      </div>
    </div>
  );
};

export default ReferralCard;
