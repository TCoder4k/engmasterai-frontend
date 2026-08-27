import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import PersonalVocabStatsChart from './PersonalVocabStatsChart';

const DATA = [
  { date: '2026-08-21', count: 0 },
  { date: '2026-08-22', count: 1 },
  { date: '2026-08-23', count: 0 },
  { date: '2026-08-24', count: 2 },
  { date: '2026-08-25', count: 0 },
  { date: '2026-08-26', count: 1 },
  { date: '2026-08-27', count: 5 },
];

const renderChart = (data = DATA) =>
  render(
    <LanguageProvider>
      <PersonalVocabStatsChart data={data} />
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('PersonalVocabStatsChart', () => {
  it('renders one bar per day, each as its own accessible, focusable hit target', () => {
    renderChart();
    const bars = screen.getAllByRole('img').filter((el) => el.tagName === 'g' || el.tagName === 'G');
    // 7 day-bars plus the chart's own outer role="img" svg.
    expect(bars.length).toBe(7);
    // SVG renders the attribute lowercased ("tabindex"), unlike HTML's
    // "tabIndex" — check via the DOM property, which normalizes either way.
    bars.forEach((bar) => expect((bar as unknown as HTMLElement).tabIndex).toBe(0));
  });

  it('selectively labels only the peak day\'s value, not every bar', () => {
    renderChart();
    expect(screen.getByText('5')).toBeInTheDocument(); // the one peak-day label
    // No other count value (1, 2) is rendered as a standalone direct label.
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('shows a tooltip with date and count on focus (same detail as hover, per the dataviz interaction spec)', async () => {
    renderChart();
    const peakBar = screen.getByRole('img', { name: /Aug 27: 5/ });

    peakBar.focus();

    expect(await screen.findByRole('status')).toHaveTextContent('5');
  });

  it('renders nothing crashy for an all-zero week (no peak to divide by)', () => {
    const { container } = renderChart(DATA.map((d) => ({ ...d, count: 0 })));
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
