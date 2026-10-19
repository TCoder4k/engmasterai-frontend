import React from 'react';
import { Crown, Zap } from 'lucide-react';
import { authService } from '../../services/authService';

interface SubscriptionStatusBadgesProps {
  user?: ReturnType<typeof authService.getUser>;
}

const SubscriptionStatusBadges: React.FC<SubscriptionStatusBadgesProps> = ({
  user = authService.getUser(),
}) => {
  const formatExpiry = (value: string | null | undefined) =>
    value
      ? new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(value))
      : null;

  const plans = [
    user?.isHocTap
      ? {
          label: 'Gói Học Tập',
          className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
          icon: Crown,
          expiresAt: user.hocTapExpiresAt,
        }
      : null,
    user?.isPro
      ? {
          label: 'Gói Pro',
          className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
          icon: Zap,
          expiresAt: user.proExpiresAt,
        }
      : null,
  ].filter((plan): plan is NonNullable<typeof plan> => plan !== null);

  if (plans.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-label="Gói đang sử dụng">
      {plans.map(({ label, className, icon: Icon, expiresAt }) => {
        const expiry = formatExpiry(expiresAt);
        return (
        <span
          key={label}
          tabIndex={0}
          title={expiry ? `Hiệu lực đến ${expiry}` : 'Gói đang sử dụng'}
          aria-label={expiry ? `${label}, hiệu lực đến ${expiry}` : label}
          className={`group relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-xs font-bold ${className}`}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {expiry && (
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg group-hover:block group-focus:block dark:bg-slate-700"
            >
              Hiệu lực đến {expiry}
            </span>
          )}
        </span>
        );
      })}
    </div>
  );
};

export default SubscriptionStatusBadges;
