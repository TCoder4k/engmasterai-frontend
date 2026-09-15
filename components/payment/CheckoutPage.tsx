import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, ShieldCheck, Clock } from 'lucide-react';
import StudentLayout from '../user/StudentLayout';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import { useTranslation } from '../../i18n/useTranslation';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { createPayment, getPayment, PaymentPresentation } from '../../services/paymentService';
import { getProfile } from '../../services/userService';

const POLL_INTERVAL_MS = 3000;
// Statuses the poll should stop on — PENDING is the only one it keeps
// running for. EXPIRED is a backend PRESENTATION value only (never a real
// database status — see PaymentPresentationStatus's own comment), so a late
// webhook could in principle still flip it to PAID; polling stops anyway
// once the countdown has visibly run out, matching what the page already
// tells the user.
const TERMINAL_STATUSES = new Set(['PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED']);

type LoadState = 'loading' | 'ready' | 'error';

const formatVnd = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hoisted to module scope, NOT defined inside CheckoutPage's render body —
// a component type declared inside another component's function is a brand
// new function identity on every parent re-render (the countdown alone
// re-renders CheckoutPage once a second), which makes React unmount and
// remount it every time, discarding its DOM node mid-interaction. Takes
// `copied` and `onCopy` as plain props instead of closing over CheckoutPage's
// state, so its own identity stays stable across renders.
const CopyButton: React.FC<{
  label: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
}> = ({ label, copied, onCopy, copyLabel, copiedLabel }) => (
  <button
    type="button"
    onClick={onCopy}
    aria-label={label}
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
  >
    {copied ? (
      <>
        <Check size={14} aria-hidden="true" />
        {copiedLabel}
      </>
    ) : (
      <>
        <Copy size={14} aria-hidden="true" />
        {copyLabel}
      </>
    )}
  </button>
);

// Frontend-facing checkout page for the one plan this sprint supports
// (PRO_MONTHLY). No fake success state — the page only ever shows PAID once
// getPayment's poll actually reports it, never optimistically.
const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const user = authService.getUser();
  const dateLocale = language === 'vi' ? 'vi-VN' : 'en-US';
  const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(dateLocale);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentPresentation | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [copiedField, setCopiedField] = useState<'account' | 'content' | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);

  const load = () => {
    setLoadState('loading');
    setError(null);
    createPayment('PRO_MONTHLY')
      .then((result) => {
        setPayment(result);
        setLoadState('ready');
      })
      .catch((err) => {
        setError(handleAuthError(err, navigate) || t.checkout.loadError);
        setLoadState('error');
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  // Poll for a status change while PENDING — same shape as
  // NotificationBell.tsx (window.setInterval + cleanup), stopped once the
  // status is terminal or the component unmounts. Depends on
  // paymentId/status (primitives), not the whole `payment` object, so a
  // PENDING->PENDING poll tick never tears down and re-creates the interval.
  useEffect(() => {
    if (!payment || TERMINAL_STATUSES.has(payment.status)) return;

    const interval = window.setInterval(() => {
      getPayment(payment.paymentId)
        .then(setPayment)
        .catch(() => {
          // Best-effort — a transient poll failure just leaves the last
          // known state on screen, matching NotificationBell's convention.
        });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [payment?.paymentId, payment?.status]);

  // Countdown recomputed from the SERVER's expiresAt on every tick, never
  // locally decremented — same idiom as PlacementTestStep.tsx. Display +
  // convenience only: a genuinely late webhook still settles the payment
  // server-side regardless of what this shows (see PaymentPresentationStatus's
  // comment).
  useEffect(() => {
    if (!payment) return;
    const tick = () => setRemainingMs(new Date(payment.expiresAt).getTime() - Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [payment?.expiresAt]);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  // Refreshes the locally stored user's isPro/proExpiresAt once, the moment
  // the poll observes PAID — same "fetch the full profile, then
  // updateStoredUser()" idiom LoginForm.tsx/RegisterForm.tsx already use
  // after sign-in, so the sidebar's "Go Premium" card reflects PRO status on
  // the very next navigation without requiring a full page reload.
  useEffect(() => {
    if (payment?.status !== 'PAID') return;
    getProfile()
      .then((profile) => authService.updateStoredUser(profile))
      .catch(() => {
        // Best-effort — the stored user simply stays stale until the next
        // natural profile fetch (e.g. the next login); the success screen
        // itself does not depend on this.
      });
  }, [payment?.status]);

  const copyText = async (field: 'account' | 'content', text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard permission denied/unavailable — the text stays visible and
      // selectable on screen either way.
    }
  };

  if (loadState === 'loading') {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </StudentLayout>
    );
  }

  if (loadState === 'error' || !payment) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto">
          <ErrorState message={error ?? t.checkout.loadError} onRetry={load} />
        </div>
      </StudentLayout>
    );
  }

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <StudentLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t.checkout.title}</h1>
          {user?.isPro && user.proExpiresAt && (
            <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
              {t.checkout.renewalNotice(formatDate(user.proExpiresAt))}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg dark:shadow-none dark:border dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.checkout.title}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <ShieldCheck size={14} aria-hidden="true" />
              {t.checkout.autoActivate}
            </span>
          </div>

          <div className="p-6 grid sm:grid-cols-[auto_1fr] gap-6 items-start">
            <img
              src={payment.qrUrl}
              alt={t.checkout.title}
              className="w-48 h-48 rounded-2xl border border-slate-100 dark:border-slate-800 mx-auto sm:mx-0"
            />

            <div className="space-y-4 min-w-0">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t.checkout.bankLabel}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{payment.bank.code}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {t.checkout.accountNumberLabel}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white break-all">
                    {payment.bank.accountNumber}
                  </p>
                  <CopyButton
                    label={`${t.checkout.copy} ${t.checkout.accountNumberLabel}`}
                    copied={copiedField === 'account'}
                    onCopy={() => copyText('account', payment.bank.accountNumber)}
                    copyLabel={t.checkout.copy}
                    copiedLabel={t.checkout.copied}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {t.checkout.accountNameLabel}
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{payment.bank.accountName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t.checkout.contentLabel}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 break-all">
                    {payment.paymentCode}
                  </p>
                  <CopyButton
                    label={`${t.checkout.copy} ${t.checkout.contentLabel}`}
                    copied={copiedField === 'content'}
                    onCopy={() => copyText('content', payment.paymentCode)}
                    copyLabel={t.checkout.copy}
                    copiedLabel={t.checkout.copied}
                  />
                </div>
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1">{t.checkout.doNotEditWarning}</p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 rounded-2xl px-4 py-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.checkout.planLabel}</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{t.checkout.planName}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 rounded-2xl px-4 py-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.checkout.amountLabel}</span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                {formatVnd(payment.amount)}
              </span>
            </div>

            {/* Status region — aria-live so a screen-reader user is told when
                this moves from pending to success/expired without needing to
                re-scan the page. */}
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-2 rounded-2xl px-4 py-5 text-center"
            >
              {payment.status === 'PAID' && (
                <>
                  <ShieldCheck size={32} className="text-emerald-500" aria-hidden="true" />
                  <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {t.checkout.statusPaid}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.checkout.statusPaidDetail}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {t.checkout.goToDashboard}
                  </button>
                </>
              )}

              {payment.status === 'EXPIRED' && (
                <>
                  <Clock size={32} className="text-slate-400" aria-hidden="true" />
                  <p className="text-base font-extrabold text-slate-700 dark:text-slate-200">
                    {t.checkout.statusExpired}
                  </p>
                  <button
                    type="button"
                    onClick={load}
                    className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {t.checkout.createNewOrder}
                  </button>
                </>
              )}

              {payment.status === 'PENDING' && (
                <>
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {t.checkout.statusPending}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t.checkout.expiresInLabel} {minutes}:{String(seconds).padStart(2, '0')}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
};

export default CheckoutPage;
