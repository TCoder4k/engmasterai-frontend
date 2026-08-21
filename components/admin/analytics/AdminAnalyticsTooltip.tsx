import React from 'react';

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
}

interface AdminAnalyticsTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
}

// Shared custom tooltip for every Recharts chart on the admin dashboard —
// Recharts' default tooltip box doesn't match the app's rounded-card visual
// language, so every chart below passes this via its own <Tooltip content=.
const AdminAnalyticsTooltip: React.FC<AdminAnalyticsTooltipProps> = ({ active, label, payload }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[160px] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-slate-200/60">
      {label && <p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((item, index) => (
          <div key={item.name ?? index} className="flex items-center justify-between gap-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <span className="text-xs text-slate-600">{item.name}</span>
            </div>
            <span className="text-xs font-bold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminAnalyticsTooltip;
