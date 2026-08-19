import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import SpeakingCatalogPage from './SpeakingCatalogPage';
import { getSpeakingScenarios } from '../../../services/speakingService';
import type { SpeakingScenarioCard } from '../../../services/speakingService';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/speakingService', () => ({
  getSpeakingScenarios: vi.fn(),
}));

const mockedGetScenarios = vi.mocked(getSpeakingScenarios);

// Speaking Partner (Phase 1+2) — same read-only, server-driven discipline as
// ListeningCatalogPage: the client never filters for visibility (a scenario
// in the response IS visible) and an error is never rendered as an empty
// catalog.
//
// 2026-08-20 — the scenario card's name is now LANGUAGE-AWARE (name/nameVi
// switch with the app's own language toggle), fixing a real report: the
// card always showed nameVi regardless of the toggle, so English mode
// never actually looked English. Default language (no stored preference)
// is 'en' (see LanguageProvider.getInitialLanguage), so tests that don't
// explicitly switch to Vietnamese now assert on the English `name` —
// matching what actually renders by default post-fix, not the old
// always-Vietnamese behaviour.
const SCENARIO_A: SpeakingScenarioCard = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ordering coffee',
  nameVi: 'Gọi đồ uống',
  description: 'Practice a short café interaction.',
  descriptionVi: 'Luyện một đoạn hội thoại ngắn ở quán café.',
  level: 'A2',
  orderIndex: 0,
  exerciseCount: 3,
  isFreeTalk: false,
};

const SCENARIO_B: SpeakingScenarioCard = {
  ...SCENARIO_A,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Job interview',
  nameVi: 'Phỏng vấn xin việc',
  level: 'B2',
};

const FREE_TALK_SCENARIO: SpeakingScenarioCard = {
  ...SCENARIO_A,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Free Talk',
  nameVi: 'Nói chuyện tự do',
  level: null,
  isFreeTalk: true,
};

const renderCatalog = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/practice/speaking']}>
          <SpeakingCatalogPage />
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  localStorage.clear(); // a VI-mode test below sets the stored language preference
});

describe('Speaking catalog — the three states never blend', () => {
  it('shows skeletons while loading, and no scenario text', async () => {
    let resolve: (value: SpeakingScenarioCard[]) => void = () => {};
    mockedGetScenarios.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    renderCatalog();

    expect(screen.queryByText(SCENARIO_A.name)).not.toBeInTheDocument();

    resolve([SCENARIO_A]);
    await screen.findByText(SCENARIO_A.name);
  });

  it('renders exactly the scenarios the server returned', async () => {
    mockedGetScenarios.mockResolvedValue([SCENARIO_A, SCENARIO_B]);

    renderCatalog();

    expect(await screen.findByText(SCENARIO_A.name)).toBeInTheDocument();
    expect(screen.getByText(SCENARIO_B.name)).toBeInTheDocument();
  });

  it('shows an explicit, retryable error — NOT an empty catalog', async () => {
    mockedGetScenarios.mockRejectedValue(
      new ApiError('Không tải được danh sách chủ đề luyện nói', 500),
    );

    renderCatalog();

    expect(
      await screen.findByText('Không tải được danh sách chủ đề luyện nói'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No speaking topics are available yet.')).not.toBeInTheDocument();

    mockedGetScenarios.mockResolvedValue([SCENARIO_A]);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(SCENARIO_A.name)).toBeInTheDocument();
  });

  it('shows an honest empty state when the server genuinely returns nothing', async () => {
    mockedGetScenarios.mockResolvedValue([]);

    renderCatalog();

    expect(
      await screen.findByText('No speaking topics are available yet.'),
    ).toBeInTheDocument();
  });
});

describe('Speaking catalog — cards state only what is real', () => {
  it('links to the UUID route, not a slug', async () => {
    mockedGetScenarios.mockResolvedValue([SCENARIO_A]);

    renderCatalog();

    const link = await screen.findByRole('link', { name: /ordering coffee/i });
    expect(link).toHaveAttribute('href', `/practice/speaking/${SCENARIO_A.id}`);
  });
});

describe('Speaking catalog — language-aware, never mixed (2026-08-20)', () => {
  it('shows the English name by default (no stored language preference)', async () => {
    mockedGetScenarios.mockResolvedValue([SCENARIO_A]);

    renderCatalog();

    expect(await screen.findByText(SCENARIO_A.name)).toBeInTheDocument();
    expect(screen.queryByText(SCENARIO_A.nameVi)).not.toBeInTheDocument();
  });

  it('shows the Vietnamese name, never the English one, once the language toggle is set to Vietnamese', async () => {
    localStorage.setItem('language', 'vi');
    mockedGetScenarios.mockResolvedValue([SCENARIO_A]);

    renderCatalog();

    expect(await screen.findByText(SCENARIO_A.nameVi)).toBeInTheDocument();
    expect(screen.queryByText(SCENARIO_A.name)).not.toBeInTheDocument();
  });
});

describe('Speaking catalog — two sections: context practice vs. Free Talk', () => {
  it('renders scenario cards under "Practice by context" and links each to its own scenario', async () => {
    mockedGetScenarios.mockResolvedValue([SCENARIO_A, SCENARIO_B]);

    renderCatalog();

    expect(await screen.findByText('Practice by context')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /ordering coffee/i });
    expect(link).toHaveAttribute('href', `/practice/speaking/${SCENARIO_A.id}`);
    expect(screen.queryByText('Free Talk')).not.toBeInTheDocument();
  });

  it('renders the one isFreeTalk scenario as its own feature card under "Free Talk"', async () => {
    mockedGetScenarios.mockResolvedValue([SCENARIO_A, FREE_TALK_SCENARIO]);

    renderCatalog();

    expect(await screen.findByText('Free Talk')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /free conversation/i });
    expect(cta).toHaveAttribute('href', `/practice/speaking/${FREE_TALK_SCENARIO.id}`);
    expect(screen.getByText('No topic limit')).toBeInTheDocument();
  });

  it('omits the "Practice by context" section entirely when only Free Talk exists', async () => {
    mockedGetScenarios.mockResolvedValue([FREE_TALK_SCENARIO]);

    renderCatalog();

    await screen.findByText('Free Talk');
    expect(screen.queryByText('Practice by context')).not.toBeInTheDocument();
  });
});

describe('Speaking catalog — mode-hub navigation', () => {
  it('shows a "Back to mode selection" link to /practice, the shared Nghe-nói hub', async () => {
    mockedGetScenarios.mockResolvedValue([SCENARIO_A]);

    renderCatalog();
    await screen.findByText(SCENARIO_A.name);

    const backLink = screen.getByRole('link', { name: /back to mode selection/i });
    expect(backLink).toHaveAttribute('href', '/practice');
  });
});
