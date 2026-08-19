import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import PracticeHubPage from './PracticeHubPage';
import { getListeningCatalog } from '../../services/listeningService';
import type { ListeningCatalogResponse } from '../../services/listeningService';

// /practice — the shared Nghe-nói (Listening/Shadowing + Speaking Partner)
// mode-selection hub. Realigned so the "Nghe - nói" nav item lands here
// first, instead of going straight to /practice/listening with Speaking
// Partner reached through a separate nav item. These tests pin the two
// requirements that actually matter for that IA change: both modes are
// presented as explicit, separately-labelled choices, and neither choice
// silently loses its destination. Vocabulary/Review were briefly kept here
// as a secondary section, then removed (2026-08-20) as redundant on a page
// whose whole point is Nghe-nói mode selection — both still have their own
// entry points elsewhere.
//
// 2026-08-20 redesign — compact two-card layout matching the product
// owner's own reference screenshot: short shared visible CTA text ("Start")
// on both buttons, so accessibility now rides on `aria-label` rather than
// visible text alone (pinned below), and a "N lessons" chip that must be a
// REAL fetched count, never a placeholder (also pinned below).

vi.mock('../../services/listeningService', () => ({
  getListeningCatalog: vi.fn(),
}));

const mockedGetCatalog = vi.mocked(getListeningCatalog);

const catalogResponse = (total: number): ListeningCatalogResponse => ({
  data: [],
  meta: { total, page: 1, limit: 1, totalPages: total },
  categories: [],
});

const renderHub = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/practice']}>
          <PracticeHubPage />
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe('PracticeHubPage — Nghe-nói mode selection', () => {
  it('presents Listening/Shadowing and Speaking Partner as two separate CTAs', () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse(12));
    renderHub();

    expect(screen.getByText('Listening & Dictation (Shadowing)')).toBeInTheDocument();
    expect(screen.getByText('Speak naturally with an AI Partner')).toBeInTheDocument();
  });

  it('the Listening CTA links to /practice/listening', () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse(12));
    renderHub();

    const cta = screen.getByRole('link', { name: /start listening practice/i });
    expect(cta).toHaveAttribute('href', '/practice/listening');
  });

  it('the Speaking Partner CTA links to /practice/speaking, never bypassing the catalog', () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse(12));
    renderHub();

    const cta = screen.getByRole('link', { name: /start speaking with ai/i });
    expect(cta).toHaveAttribute('href', '/practice/speaking');
  });

  it('both CTAs show the same short visible label, but stay distinguishable via their accessible name', () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse(12));
    renderHub();

    const listeningCta = screen.getByRole('link', { name: /start listening practice/i });
    const speakingCta = screen.getByRole('link', { name: /start speaking with ai/i });
    // Same visible text on both — matches the reference screenshot's two
    // identically-worded "Start"/"Bắt đầu" buttons.
    expect(listeningCta).toHaveTextContent('Start');
    expect(speakingCta).toHaveTextContent('Start');
    // Different accessible names (via aria-label) is what keeps two
    // identically-worded buttons distinguishable to assistive tech.
    expect(listeningCta.getAttribute('aria-label')).not.toBe(speakingCta.getAttribute('aria-label'));
  });
});

describe('PracticeHubPage — the Shadowing lesson-count chip is a REAL number, never fabricated', () => {
  it('fetches shadowing-mode content and shows the real count once it resolves', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse(12));
    renderHub();

    expect(mockedGetCatalog).toHaveBeenCalledWith({ mode: 'SHADOWING', limit: 1 });
    await waitFor(() => expect(screen.getByText('12 lessons')).toBeInTheDocument());
  });

  it('shows no count chip at all while the fetch is still in flight — never a placeholder like 0', () => {
    mockedGetCatalog.mockReturnValue(new Promise(() => {})); // never resolves
    renderHub();

    expect(screen.queryByText(/lesson/i)).not.toBeInTheDocument();
  });

  it('shows no count chip if the fetch fails — a decorative chip is not worth an error state', async () => {
    mockedGetCatalog.mockRejectedValue(new Error('network down'));
    renderHub();

    await waitFor(() => expect(mockedGetCatalog).toHaveBeenCalled());
    expect(screen.queryByText(/lesson/i)).not.toBeInTheDocument();
    // The rest of the page must stay fully usable regardless.
    expect(screen.getByRole('link', { name: /start listening practice/i })).toBeInTheDocument();
  });

  it('pluralizes down to one lesson correctly', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse(1));
    renderHub();

    await waitFor(() => expect(screen.getByText('1 lesson')).toBeInTheDocument());
  });
});
