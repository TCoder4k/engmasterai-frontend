import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AdminAnalyticsTooltip from './AdminAnalyticsTooltip';
import type { AdminUserGrowth } from '../../../services/adminAnalyticsService';

interface UserGrowthChartProps {
  userGrowth: AdminUserGrowth;
}

interface GrowthStatProps {
  label: string;
  value: string;
  changeLabel?: string;
  positive?: boolean;
}

const GrowthStat: React.FC<GrowthStatProps> = ({ label, value, changeLabel, positive }) => (
  <div>
    <p className="text-[10px] font-medium text-slate-500">{label}</p>
    <div className="mt-1 flex items-baseline gap-2">
      <strong className="text-lg font-bold text-slate-900">{value}</strong>
      {changeLabel && (
        <span
          className={`text-[10px] font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}
        >
          {changeLabel}
        </span>
      )}
    </div>
  </div>
);

// "2026-08-15" -> "15/08" — matches the vi-VN date convention used elsewhere
// on this dashboard (day/month), instead of the raw ISO month-day slice.
const formatAxisDate = (value: string): string => {
  const [, month, day] = value.split('-');
  return day && month ? `${day}/${month}` : value;
};

const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ userGrowth }) => (
  <section className="rounded-3xl border border-slate-100 bg-white shadow-sm p-6 sm:p-8 h-full flex flex-col">
    <div className="mb-6">
      <h3 className="text-lg font-bold text-slate-900">Người dùng tăng trưởng</h3>
      <p className="text-xs text-slate-400 font-medium mt-1">30 ngày qua</p>
    </div>

    <div className="h-56 min-h-[224px] w-full">
      {/* debounce avoids a full re-measure (and re-triggered enter animation)
          on every sub-pixel reflow while the page scrolls, which otherwise
          reads as the chart jittering/resizing under the cursor. */}
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <AreaChart data={userGrowth.dailyCumulative} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="userGrowthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            tickFormatter={formatAxisDate}
            interval="preserveStartEnd"
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
          <Tooltip content={<AdminAnalyticsTooltip />} labelFormatter={formatAxisDate} />
          <Area
            type="monotone"
            dataKey="totalStudents"
            name="Tổng học viên"
            stroke="#7C3AED"
            strokeWidth={2.5}
            fill="url(#userGrowthGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#7C3AED', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
      <GrowthStat label="Tổng người dùng" value={String(userGrowth.totalStudents)} />
      <GrowthStat
        label="Tăng trong 30 ngày"
        value={`+${userGrowth.newLast30d}`}
        changeLabel={userGrowth.newLast30d > 0 ? `↑ ${userGrowth.newLast30d}` : undefined}
        positive
      />
    </div>
  </section>
);

export default UserGrowthChart;
