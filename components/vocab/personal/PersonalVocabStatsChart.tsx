import React, { useId, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

interface PersonalVocabStatsChartProps {
  /** Ascending, 7 entries, ending today — GET /vocab-personal/stats' shape. */
  data: { date: string; count: number }[];
}

const CHART_WIDTH = 260;
const CHART_HEIGHT = 96;
const BASELINE_Y = CHART_HEIGHT - 18; // leaves room for weekday labels below
const BAR_MAX_HEIGHT = BASELINE_Y - 20; // leaves room for a value label above the tallest bar
const BAR_RADIUS = 4;
const BAR_COLOR = '#3b82f6'; // blue-500 — this app's established primary accent everywhere else

// Single-series bar chart, built per the dataviz skill's mark spec: thin
// bars, 4px-rounded data-end (top) with a square baseline, one hue (no
// legend needed for a single series — the card's own title names it),
// selective direct labeling (only the peak day gets a value, per "never a
// number on every point"), and a hover/focus tooltip on each bar as its own
// hit target (same detail on keyboard focus as on mouse hover).
const topRoundedRectPath = (x: number, y: number, width: number, height: number): string => {
  const r = Math.min(BAR_RADIUS, width / 2, height);
  if (height <= 0) return '';
  if (r <= 0) {
    return `M ${x} ${y + height} L ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} Z`;
  }
  return `
    M ${x} ${y + height}
    L ${x} ${y + r}
    Q ${x} ${y} ${x + r} ${y}
    L ${x + width - r} ${y}
    Q ${x + width} ${y} ${x + width} ${y + r}
    L ${x + width} ${y + height}
    Z
  `;
};

const PersonalVocabStatsChart: React.FC<PersonalVocabStatsChartProps> = ({ data }) => {
  const { t, language } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId();

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const peakIndex = data.reduce(
    (best, d, i) => (d.count > data[best].count ? i : best),
    0,
  );
  const weekdayFormatter = new Intl.DateTimeFormat(language, { weekday: 'narrow' });
  const fullDateFormatter = new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' });
  const gap = 6;
  const barWidth = (CHART_WIDTH - gap * (data.length - 1)) / data.length;

  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.myVocab.statsChartTitle}</p>
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t.myVocab.statsChartSubtitle}</p>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={t.myVocab.statsChartTitle}
          className="w-full h-auto"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BAR_COLOR} stopOpacity="1" />
              <stop offset="100%" stopColor={BAR_COLOR} stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Baseline — one-step-off-surface gray, hairline, solid. */}
          <line
            x1={0}
            y1={BASELINE_Y}
            x2={CHART_WIDTH}
            y2={BASELINE_Y}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth={1}
          />

          {data.map((d, i) => {
            const x = i * (barWidth + gap);
            const height = maxCount > 0 ? Math.round((d.count / maxCount) * BAR_MAX_HEIGHT) : 0;
            const minVisibleHeight = d.count > 0 ? Math.max(height, 3) : 0;
            const y = BASELINE_Y - minVisibleHeight;
            const isPeak = i === peakIndex && d.count > 0;
            const isActive = activeIndex === i;
            const weekdayLabel = weekdayFormatter.format(new Date(`${d.date}T12:00:00.000Z`));

            return (
              <g
                key={d.date}
                tabIndex={0}
                role="img"
                aria-label={`${fullDateFormatter.format(new Date(`${d.date}T12:00:00.000Z`))}: ${d.count}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex((prev) => (prev === i ? null : prev))}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex((prev) => (prev === i ? null : prev))}
                className="cursor-pointer focus:outline-none"
              >
                {/* Bigger-than-the-mark hit target, full column height. */}
                <rect x={x} y={0} width={barWidth} height={CHART_HEIGHT} fill="transparent" />
                {isPeak && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400"
                    style={{ fontSize: 9, fontWeight: 700 }}
                  >
                    {d.count}
                  </text>
                )}
                {minVisibleHeight > 0 && (
                  <path
                    d={topRoundedRectPath(x, y, barWidth, minVisibleHeight)}
                    fill={`url(#${gradientId})`}
                    opacity={isActive ? 1 : 0.9}
                  />
                )}
                <text
                  x={x + barWidth / 2}
                  y={CHART_HEIGHT - 4}
                  textAnchor="middle"
                  className="fill-slate-400 dark:fill-slate-500"
                  style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}
                >
                  {weekdayLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-semibold shadow-lg whitespace-nowrap"
            role="status"
          >
            <span className="opacity-70 mr-1">
              {fullDateFormatter.format(new Date(`${active.date}T12:00:00.000Z`))}
            </span>
            <span className="font-bold">{active.count}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalVocabStatsChart;
