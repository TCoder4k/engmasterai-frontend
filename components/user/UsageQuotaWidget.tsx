import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { getUsageQuota, UsageKind, UsageQuotaStatus } from '../../services/usageService';

// 2026-09-16 pricing relaunch (Phase B) — the "Gói Free · AI 17/20 · Chấm
// bài 1/2" style widget from the product owner's own reference mockup.
// Read-only: fetches GET /usage/quota once on mount, never increments
// anything itself — the actual quota-consuming calls happen inside
// Dictionary/Chat/Shadowing/Speaking's own endpoints, which this widget has
// no relationship to beyond displaying their aggregate result.
//
// Silent on any load failure (best-effort display, same "don't block the
// page over a non-critical widget" philosophy as StudentDesktopSidebar's
// own avatar-menu fetch) — a missing quota bar is a minor omission, not
// something worth an error state taking up sidebar space.
//
// Dashboard redesign (2026-09) — no upgrade CTA of its own any more. The
// sidebar's single PRO card right below this one is now the ONLY "Mở PRO"
// button on the rail; a second competing CTA here (as before, shown once
// any bar got low) was exactly the duplicated-CTA problem the redesign
// asked to remove.

const KIND_LABEL: Record<UsageKind, string> = {
  aiQuery: 'Tra cứu AI',
  aiGrading: 'Chấm bài AI',
  speaking: 'Luyện nói AI',
};

const UsageQuotaWidget: React.FC<{ variant?: 'sidebar' | 'profile' }> = ({ variant = 'sidebar' }) => {
  const { t } = useTranslation();
  const [quota, setQuota] = useState<UsageQuotaStatus[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUsageQuota()
      .then((status) => {
        if (!cancelled) setQuota(status);
      })
      .catch(() => {
        // Best-effort — the widget simply doesn't render.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quota) return null;

  return (
    <section
      aria-label={t.widgets.usageToday}
      className={`${variant === 'profile' ? 'border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/60'} rounded-2xl p-4 space-y-2.5`}
    >
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {t.widgets.usageToday}
      </p>
      {quota.map((q) => {
        const remaining = Math.max(0, q.limit - q.used);
        const atLimit = remaining === 0;
        const low = !atLimit && remaining <= Math.max(1, Math.ceil(q.limit * 0.15));
        const pct = q.limit > 0 ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
        const barColor = atLimit ? 'bg-rose-500' : low ? 'bg-amber-500' : 'bg-blue-500';
        return (
          <div key={q.kind}>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              <span>{KIND_LABEL[q.kind]}</span>
              <span className={atLimit ? 'text-rose-500 font-bold' : low ? 'text-amber-600 font-bold' : ''}>
                {q.used}/{q.limit}
              </span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default UsageQuotaWidget;
