import React, { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { BookOpen, Headphones, Mic2 } from 'lucide-react';
import AdminAnalyticsTooltip from './AdminAnalyticsTooltip';
import type { AdminSkillBreakdown, AdminSkillType } from '../../../services/adminAnalyticsService';

interface SkillBreakdownChartProps {
  skills: AdminSkillBreakdown[];
}

// Lighter tints than the app's usual saturated 600-level palette — a full
// donut ring reads better in pastel than in bold color at this size.
const SKILL_CONFIG: Record<
  AdminSkillType,
  { icon: React.ElementType; title: string; description: string; color: string; iconClass: string }
> = {
  LISTENING: {
    icon: Headphones,
    title: 'Nghe',
    description: 'Listening Dictation / Segment',
    color: '#60A5FA',
    iconClass: 'bg-blue-50 text-blue-600',
  },
  SPEAKING: {
    icon: Mic2,
    title: 'Nói',
    description: 'Speaking Scenarios / Free Talk',
    color: '#34D399',
    iconClass: 'bg-emerald-50 text-emerald-600',
  },
  VOCAB_GRAMMAR: {
    icon: BookOpen,
    title: 'Từ vựng & Ngữ pháp',
    description: 'Flashcard / Quiz / Ngữ pháp',
    color: '#FB923C',
    iconClass: 'bg-orange-50 text-orange-600',
  },
};

const SkillBreakdownChart: React.FC<SkillBreakdownChartProps> = ({ skills }) => {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = skills.reduce((sum, skill) => sum + skill.sessionCount, 0);
  const chartData = skills.map((skill) => ({
    name: SKILL_CONFIG[skill.type].title,
    value: skill.sessionCount,
    color: SKILL_CONFIG[skill.type].color,
  }));

  return (
    <section className="rounded-3xl border border-slate-100 bg-white shadow-sm p-6 sm:p-8 h-full">
      <h3 className="text-lg font-bold text-slate-900">Thống kê kỹ năng luyện tập</h3>
      <p className="text-xs text-slate-400 font-medium mt-1 mb-6">
        Phân bố hoạt động học tập theo kỹ năng (7 ngày qua, theo số phiên)
      </p>

      <div className="relative h-44 min-h-[176px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={78}
              paddingAngle={2}
              strokeWidth={0}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  cursor="pointer"
                  opacity={activeIndex === undefined || activeIndex === index ? 1 : 0.45}
                  style={{ transition: 'opacity 150ms ease' }}
                />
              ))}
            </Pie>
            <Tooltip content={<AdminAnalyticsTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-2xl font-bold text-slate-900">{total}</strong>
          <span className="text-[10px] text-slate-500">phiên</span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {skills.map((skill) => {
          const config = SKILL_CONFIG[skill.type];
          const Icon = config.icon;
          const percentage = total > 0 ? Math.round((skill.sessionCount / total) * 100) : 0;
          return (
            <div key={skill.type} className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconClass}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800">{config.title}</p>
                <p className="truncate text-[10px] text-slate-400">{config.description}</p>
              </div>
              <strong className="text-xs text-slate-900">{percentage}%</strong>
              <span className="w-8 text-right text-xs text-slate-500">{skill.sessionCount}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SkillBreakdownChart;
