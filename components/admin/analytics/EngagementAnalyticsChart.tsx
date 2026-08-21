import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Mic2, MessageCircle, Target, Users } from 'lucide-react';
import AdminAnalyticsTooltip from './AdminAnalyticsTooltip';
import type { AdminEngagementPoint, AdminSummary } from '../../../services/adminAnalyticsService';

interface EngagementAnalyticsChartProps {
  summary: AdminSummary;
  engagement: AdminEngagementPoint[];
}

const ChangeBadge: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span className={`text-[11px] font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
};

interface MiniMetricProps {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  value: string;
  change: number | null;
  valueHint?: string;
}

const MiniMetric: React.FC<MiniMetricProps> = ({ icon: Icon, iconClass, title, value, change, valueHint }) => (
  <article className="rounded-xl border border-slate-200 bg-white p-3.5">
    <div className="flex items-start gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon size={18} />
      </div>
      <p className="text-[11px] font-semibold leading-4 text-slate-600">{title}</p>
    </div>
    <div className="mt-2.5 flex items-end justify-between gap-2">
      <strong
        className={`text-xl font-bold ${valueHint ? 'text-slate-300' : 'text-slate-950'}`}
        title={valueHint}
      >
        {value}
      </strong>
      <ChangeBadge value={change} />
    </div>
  </article>
);

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    <span className="text-xs text-slate-500">{label}</span>
  </div>
);

// "2026-08-15" -> "15/08" — matches the vi-VN date convention used elsewhere
// on this dashboard (day/month), instead of the raw ISO month-day slice.
const formatAxisDate = (value: string): string => {
  const [, month, day] = value.split('-');
  return day && month ? `${day}/${month}` : value;
};

// The card's 4 mini-metrics — labels/scope deliberately match what the
// backend can actually prove (see admin-dashboard-analytics.types.ts):
// aiSessions7d/aiTurns7d are Speaking Partner only (Engy Chat has no
// persisted history to count), and neither is called "API calls" — Gemini
// Live is one WebSocket per attempt, not one request per turn.
const EngagementAnalyticsChart: React.FC<EngagementAnalyticsChartProps> = ({ summary, engagement }) => (
  <section className="rounded-3xl border border-slate-100 bg-white shadow-sm p-6 sm:p-8 h-full">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Thống kê Tương tác &amp; Hoạt động Hệ thống</h3>
        <p className="text-xs text-slate-400 font-medium mt-1">
          Tổng quan mức độ sử dụng và hiệu quả học tập của học viên (7 ngày qua)
        </p>
      </div>
    </div>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
      <MiniMetric
        icon={Users}
        iconClass="bg-blue-50 text-blue-600"
        title="Học viên active trung bình/ngày"
        value={String(summary.dauAvg7d)}
        change={summary.dauAvg7dChangePercent}
      />
      <MiniMetric
        icon={Target}
        iconClass="bg-emerald-50 text-emerald-600"
        title="Tỷ lệ bài học đạt"
        value={summary.passRatePercent === null ? '—' : `${summary.passRatePercent}%`}
        change={summary.passRatePercentChangePercent}
        valueHint={summary.passRatePercent === null ? 'Chưa có dữ liệu' : undefined}
      />
      <MiniMetric
        icon={Mic2}
        iconClass="bg-violet-50 text-violet-600"
        title="Phiên luyện nói với AI"
        value={String(summary.aiSessions7d)}
        change={summary.aiSessions7dChangePercent}
      />
      <MiniMetric
        icon={MessageCircle}
        iconClass="bg-amber-50 text-amber-600"
        title="Lượt hội thoại AI"
        value={String(summary.aiTurns7d)}
        change={summary.aiTurns7dChangePercent}
      />
    </div>

    <p className="text-xs font-bold text-slate-500 mb-6">Chỉ số AI: Speaking Partner</p>

    <div className="h-64 min-h-[256px] w-full">
      {/* debounce avoids a full re-measure (and re-triggered enter animation)
          on every sub-pixel reflow while the page scrolls, which otherwise
          reads as the chart jittering/resizing under the cursor. */}
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <AreaChart data={engagement} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="activeUsersGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickFormatter={formatAxisDate}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
          <Tooltip content={<AdminAnalyticsTooltip />} labelFormatter={formatAxisDate} />
          <Area
            type="monotone"
            dataKey="activeUsers"
            name="Học viên active (DAU)"
            stroke="#2563EB"
            strokeWidth={2.5}
            fill="url(#activeUsersGradient)"
            dot={{ r: 4, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-3 flex items-center gap-5">
      <LegendDot color="#2563EB" label="Học viên active (DAU)" />
    </div>
  </section>
);

export default EngagementAnalyticsChart;
