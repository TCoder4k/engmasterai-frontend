import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Zap, Clock, AlertCircle, CheckCircle2, Info, Crown, Landmark, CreditCard, User, MessageSquare, Sparkles } from 'lucide-react';
import StudentLayout from '../user/StudentLayout';
import BackButton from '../shared/BackButton';
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

// One "field card" in the transfer-info panel: a rounded, tinted block with a
// leading icon badge, so every field (bank/account number/account
// name/content) reads as its own distinct unit instead of a plain table row.
const InfoRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, label, value, valueClassName, action }) => (
  <div className="rounded-xl bg-slate-50 px-3.5 py-2 dark:bg-slate-800/60">
    <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400">
          <Icon size={13} aria-hidden="true" />
        </span>
        <span className={`break-all ${valueClassName ?? 'font-bold text-slate-900 dark:text-white'}`}>{value}</span>
      </div>
      {action}
    </div>
  </div>
);

// Frontend-facing checkout page for the one plan this sprint supports
// (PRO_MONTHLY). No fake success state — the page only ever shows PAID once
// getPayment's poll actually reports it, never optimistically.
//
// Uses the normal StudentLayout shell (sidebar + top utility bar) — a
// checkout flow reached from the sidebar's own "Nâng cấp PRO" entry should
// keep that same chrome, not drop the student into an unfamiliar shell.
// The content itself stays deliberately compact (merged status/step strip,
// tightened spacing) so the whole flow still fits one screen without
// scrolling, even with the sidebar taking up its own width.
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
  const [paidExpiry, setPaidExpiry] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'bank' | 'account' | 'name' | 'content' | null>(null);
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
      .then((profile) => {
        setPaidExpiry(profile.proExpiresAt);
        authService.updateStoredUser({ ...profile, avatarUrl: profile.avatarUrl ?? undefined });
      })
      .catch(() => {
        // Best-effort — the stored user simply stays stale until the next
        // natural profile fetch (e.g. the next login); the success screen
        // itself does not depend on this.
      });
  }, [payment?.status]);

  const copyText = async (field: 'bank' | 'account' | 'name' | 'content', text: string): Promise<void> => {
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

  const TitleBlock = () => (
    <div className="space-y-1.5">
      <BackButton to="/home" label={t.common.back} className="!min-h-0 !py-1.5" />
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <Crown size={17} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{t.checkout.title}</h1>
      </div>
    </div>
  );

  if (loadState === 'loading') {
    return (
      <StudentLayout>
        <div className="mx-auto max-w-[1180px] space-y-4">
          <Skeleton className="h-16 w-80" />
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,360px)]">
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-[420px] w-full" />
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (loadState === 'error' || !payment) {
    return (
      <StudentLayout>
        <div className="mx-auto max-w-[1180px] space-y-4">
          <TitleBlock />
          <ErrorState message={error ?? t.checkout.loadError} onRetry={load} />
        </div>
      </StudentLayout>
    );
  }

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isPaid = payment.status === 'PAID';
  const isPending = payment.status === 'PENDING';
  const isExpired = !isPaid && !isPending;
  const stepState = isPaid ? 3 : isExpired ? 0 : 1;
  const expiryIso = paidExpiry ?? user?.proExpiresAt;
  const expiryDate = expiryIso ? formatDate(expiryIso) : null;

  const steps = [t.checkout.stepTransfer, t.checkout.stepConfirm, t.checkout.stepActivate];

  const notes = [
    { title: t.checkout.noteKeepContent, detail: t.checkout.noteKeepContentDetail },
    { title: t.checkout.noteExactAmount, detail: t.checkout.noteExactAmountDetail },
    { title: t.checkout.noteTimeLimit, detail: t.checkout.noteTimeLimitDetail },
    { title: t.checkout.noteIssue, detail: t.checkout.noteIssueDetail },
  ];

  return (
    <StudentLayout>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <TitleBlock />
        </div>
        {user?.isPro && user.proExpiresAt ? (
          <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t.checkout.renewalNotice(formatDate(user.proExpiresAt))}
          </p>
        ) : (
          <section className="-mt-1 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-4 dark:border-blue-500/20 dark:from-blue-500/15 dark:via-indigo-500/10 dark:to-slate-900 sm:p-5">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-950">
              <Sparkles size={12} aria-hidden="true" />
              {t.checkout.earlyMemberBadge}
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl dark:text-white">
                {t.checkout.heroHeadline(formatVnd(payment.amount))}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.checkout.heroSubline}</p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {t.checkout.reassuranceBullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/80 px-3.5 py-2.5 text-xs font-medium text-blue-900 sm:text-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
          <Info size={16} className="shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <span>{t.checkout.activationBanner}</span>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,360px)]">
            <div className="flex flex-col gap-4">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-800/90">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-700/80">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{t.checkout.transferTitle}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.checkout.transferSubtitle}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Zap size={13} aria-hidden="true" />
                    {t.checkout.autoActivate}
                  </span>
                </div>

                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-stretch">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center rounded-xl bg-white p-1 dark:bg-slate-900">
                      <img src={payment.qrUrl} alt={t.checkout.title} className="h-full w-full rounded-lg object-contain" />
                    </div>
                    <p className="mx-auto mt-2 max-w-[220px] text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t.checkout.qrLabel}</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <InfoRow
                      icon={Landmark}
                      label={t.checkout.bankLabel}
                      value={payment.bank.code}
                      action={<CopyButton label={`${t.checkout.copy} ${t.checkout.bankLabel}`} copied={copiedField === 'bank'} onCopy={() => copyText('bank', payment.bank.code)} copyLabel={t.checkout.copy} copiedLabel={t.checkout.copied} />}
                    />
                    <InfoRow
                      icon={CreditCard}
                      label={t.checkout.accountNumberLabel}
                      value={payment.bank.accountNumber}
                      valueClassName="font-mono text-base font-bold text-slate-900 dark:text-white"
                      action={<CopyButton label={`${t.checkout.copy} ${t.checkout.accountNumberLabel}`} copied={copiedField === 'account'} onCopy={() => copyText('account', payment.bank.accountNumber)} copyLabel={t.checkout.copy} copiedLabel={t.checkout.copied} />}
                    />
                    <InfoRow
                      icon={User}
                      label={t.checkout.accountNameLabel}
                      value={payment.bank.accountName}
                      action={<CopyButton label={`${t.checkout.copy} ${t.checkout.accountNameLabel}`} copied={copiedField === 'name'} onCopy={() => copyText('name', payment.bank.accountName)} copyLabel={t.checkout.copy} copiedLabel={t.checkout.copied} />}
                    />
                    <InfoRow
                      icon={MessageSquare}
                      label={t.checkout.contentLabel}
                      value={payment.paymentCode}
                      valueClassName="font-mono text-base font-extrabold tracking-wide text-blue-600 dark:text-blue-400"
                      action={<CopyButton label={`${t.checkout.copy} ${t.checkout.contentLabel}`} copied={copiedField === 'content'} onCopy={() => copyText('content', payment.paymentCode)} copyLabel={t.checkout.copy} copiedLabel={t.checkout.copied} />}
                    />
                  </div>
                </div>
              </section>

              <section
                role="status"
                aria-live="polite"
                className={`flex flex-col gap-3 rounded-2xl border px-4 py-3.5 shadow-sm sm:px-5 lg:flex-row lg:items-center lg:justify-between ${isPaid ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10' : isExpired ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900' : 'border-blue-100 bg-white dark:border-slate-700/80 dark:bg-slate-800/90'}`}
              >
                {isPaid ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-extrabold text-emerald-800 sm:text-base dark:text-emerald-200">{t.checkout.statusPaid}</p>
                        {expiryDate ? (
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t.checkout.statusPaidExpiry(expiryDate)}</p>
                        ) : (
                          <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">{t.checkout.statusPaidDetail}</p>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => navigate('/home')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">{t.checkout.goToDashboard}</button>
                  </div>
                ) : isExpired ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Clock size={22} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-800 sm:text-base dark:text-slate-100">{t.checkout.statusExpired}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.checkout.noteTimeLimitDetail}</p>
                      </div>
                    </div>
                    <button type="button" onClick={load} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">{t.checkout.createNewOrder}</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 sm:text-base dark:text-white">{t.checkout.statusPending}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.checkout.timeRemaining}: <span className="font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">{minutes}:{String(seconds).padStart(2, '0')}</span></p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-black/5 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 dark:border-white/10">
                  {steps.map((label, index) => {
                    const completed = stepState === 3 || (stepState === 1 && index === 0);
                    const active = stepState === 1 && index === 0;
                    const failed = stepState === 0 && index === 0;
                    return (
                      <React.Fragment key={label}>
                        <div className="flex items-center gap-1.5">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${completed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : active ? 'bg-blue-600 text-white' : failed ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>{completed && !active ? <Check size={12} aria-hidden="true" /> : index + 1}</span>
                          <span className={`hidden text-xs font-bold sm:inline ${completed || active ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{label}</span>
                        </div>
                        {index < steps.length - 1 && <div className="h-px w-4 shrink-0 bg-slate-200 sm:w-6 dark:bg-slate-700" />}
                      </React.Fragment>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700/80 dark:bg-slate-800/90">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{t.checkout.orderSummaryTitle}</h2>
                    <p className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.checkout.planLabel}</p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t.checkout.planName}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{t.checkout.monthBadge}</span>
                </div>
                <div className="mt-3.5 border-t border-slate-100 pt-3.5 dark:border-slate-700/80">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.checkout.benefitsTitle}</p>
                  <ul className="mt-2 space-y-1.5">
                    {t.checkout.benefits.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"><Check size={15} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />{benefit}</li>)}
                  </ul>
                </div>
                <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-3.5 py-3 dark:bg-blue-500/10">
                  <span className="text-sm font-bold text-blue-900/80 dark:text-blue-200/80">{t.checkout.amountLabel}</span>
                  <span className="flex items-baseline gap-2">
                    {payment.compareAtAmount !== null && payment.compareAtAmount > payment.amount && (
                      <span className="text-xs font-semibold text-slate-400 line-through dark:text-slate-500">
                        {formatVnd(payment.compareAtAmount)}
                      </span>
                    )}
                    <span className="text-xl font-extrabold tracking-tight text-blue-700 dark:text-blue-300">{formatVnd(payment.amount)}</span>
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <h2 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">{t.checkout.importantNotesTitle}</h2>
                <ol className="mt-3 space-y-2.5">
                  {notes.map((note, index) => (
                    <li key={note.title} className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-[11px] font-extrabold text-amber-800 dark:bg-amber-500/25 dark:text-amber-200">{index + 1}</span>
                      <div>
                        <p className="text-xs font-bold leading-snug text-amber-900 dark:text-amber-100">{note.title}</p>
                        <p className="text-[11px] leading-snug text-amber-800/80 dark:text-amber-200/70">{note.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
          </aside>
        </div>
      </div>
    </StudentLayout>
  );
};

export default CheckoutPage;
