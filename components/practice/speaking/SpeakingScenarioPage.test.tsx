import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import SpeakingScenarioPage from './SpeakingScenarioPage';
import { getSpeakingScenario } from '../../../services/speakingService';
import type { SpeakingScenarioDetail } from '../../../services/speakingService';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/speakingService', () => ({
  getSpeakingScenario: vi.fn(),
}));

const mockedGetScenario = vi.mocked(getSpeakingScenario);

const SCENARIO_ID = '11111111-1111-4111-8111-111111111111';

// 2026-08-20 — exercise/scenario names and descriptions are now
// LANGUAGE-AWARE (switch with the app's own language toggle), fixing a
// real report: this page always showed titleVi/nameVi regardless of the
// toggle, with description staying English-only forever (descriptionVi did
// not exist yet). Default language (no stored preference) is 'en' (see
// LanguageProvider.getInitialLanguage), so tests below assert on the
// English fields unless a test explicitly switches to Vietnamese.
const DETAIL: SpeakingScenarioDetail = {
  id: SCENARIO_ID,
  name: 'Ordering coffee',
  nameVi: 'Gọi đồ uống',
  description: 'Practice a short café interaction.',
  descriptionVi: 'Luyện một đoạn hội thoại ngắn ở quán café.',
  level: 'A2',
  isFreeTalk: false,
  exercises: [
    {
      id: 'ex-1',
      title: 'Order a latte',
      titleVi: 'Gọi một ly latte',
      description: 'Order a drink at a café.',
      descriptionVi: 'Gọi một món đồ uống ở quán café.',
      level: 'A2',
      openingLine: "Hi there! What can I get you today?",
    },
  ],
};

const renderScenario = (scenarioId = SCENARIO_ID) =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[`/practice/speaking/${scenarioId}`]}>
          <Routes>
            <Route path="/practice/speaking/:scenarioId" element={<SpeakingScenarioPage />} />
            {/* Stub for the Free Talk auto-redirect's destination, so a test
                can assert real navigation happened rather than just an href. */}
            <Route
              path="/practice/speaking/:scenarioId/:exerciseId"
              element={<div>SESSION_STUB</div>}
            />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  localStorage.clear(); // a VI-mode test below sets the stored language preference
});

describe('Speaking scenario page', () => {
  it('renders the exercises the server returned, in order', async () => {
    mockedGetScenario.mockResolvedValue(DETAIL);

    renderScenario();

    expect(await screen.findByText('Order a latte')).toBeInTheDocument();
    // No hidden AI-context fields ever land on the page.
    expect(screen.queryByText(/opening line/i)).not.toBeInTheDocument();
  });

  it('links each exercise to the session route', async () => {
    mockedGetScenario.mockResolvedValue(DETAIL);

    renderScenario();

    const link = await screen.findByRole('link', { name: /order a latte/i });
    expect(link).toHaveAttribute('href', `/practice/speaking/${SCENARIO_ID}/ex-1`);
  });

  it('shows an explicit, retryable error — never a blank page', async () => {
    mockedGetScenario.mockRejectedValue(new ApiError('Không tải được chủ đề luyện nói', 404));

    renderScenario();

    expect(await screen.findByText('Không tải được chủ đề luyện nói')).toBeInTheDocument();

    mockedGetScenario.mockResolvedValue(DETAIL);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Order a latte')).toBeInTheDocument();
  });

  it('shows an honest empty state when a scenario has no exercises yet', async () => {
    mockedGetScenario.mockResolvedValue({ ...DETAIL, exercises: [] });

    renderScenario();

    expect(await screen.findByText('This topic has no exercises yet.')).toBeInTheDocument();
  });
});

describe('Speaking scenario page — language-aware, never mixed (2026-08-20)', () => {
  it('shows the English scenario name and exercise title by default (no stored language preference)', async () => {
    mockedGetScenario.mockResolvedValue(DETAIL);

    renderScenario();

    expect(await screen.findByText(DETAIL.name)).toBeInTheDocument();
    expect(await screen.findByText('Order a latte')).toBeInTheDocument();
    expect(screen.queryByText(DETAIL.nameVi)).not.toBeInTheDocument();
    expect(screen.queryByText('Gọi một ly latte')).not.toBeInTheDocument();
  });

  it('shows the Vietnamese scenario name and exercise title once the language toggle is set to Vietnamese', async () => {
    localStorage.setItem('language', 'vi');
    mockedGetScenario.mockResolvedValue(DETAIL);

    renderScenario();

    expect(await screen.findByText(DETAIL.nameVi)).toBeInTheDocument();
    expect(await screen.findByText('Gọi một ly latte')).toBeInTheDocument();
    expect(screen.queryByText(DETAIL.name)).not.toBeInTheDocument();
    expect(screen.queryByText('Order a latte')).not.toBeInTheDocument();
  });
});

describe('Speaking scenario page — Free Talk auto-redirect', () => {
  it('redirects straight into the session when isFreeTalk with exactly one exercise', async () => {
    mockedGetScenario.mockResolvedValue({ ...DETAIL, isFreeTalk: true });

    renderScenario();

    expect(await screen.findByText('SESSION_STUB')).toBeInTheDocument();
    expect(screen.queryByText('Order a latte')).not.toBeInTheDocument();
  });

  it('does NOT auto-redirect a normal (non-Free-Talk) scenario, even with one exercise', async () => {
    mockedGetScenario.mockResolvedValue(DETAIL);

    renderScenario();

    expect(await screen.findByText('Order a latte')).toBeInTheDocument();
    expect(screen.queryByText('SESSION_STUB')).not.toBeInTheDocument();
  });
});
