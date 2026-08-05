import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ListeningCatalogPage from './ListeningCatalogPage';
import { getListeningCatalog } from '../../../services/listeningService';
import type {
  ListeningCard,
  ListeningCatalogResponse,
} from '../../../services/listeningService';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/listeningService', () => ({
  getListeningCatalog: vi.fn(),
}));

const mockedGetCatalog = vi.mocked(getListeningCatalog);

// Sprint 11 Phase 2 — replaces the seed-era catalog test.
//
// WHAT THE OLD TESTS PROVED AND WHY THEY HAD TO GO. They asserted that every
// count equalled `DICTATION_LESSONS.length` — i.e. that the page faithfully
// rendered a hardcoded array. That was true, and it was the bug: the page
// rendered five recordings that the backend correctly reported as invisible,
// because the page never asked the backend anything.
//
// The replacements assert the property that actually matters now: THE PAGE
// SHOWS THE SERVER'S ANSWER AND NOTHING ELSE. It cannot invent a card, cannot
// fall back to a bundled list when a request fails, and cannot present a
// failure as an empty catalog.
const CARD_A: ListeningCard = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Otter Moms Wrap Their Babies',
  description: 'A short nature clip.',
  level: 'B1',
  thumbnailUrl: null,
  durationMs: 180000,
  segmentCount: 3,
  supportedModes: ['DICTATION', 'SHADOWING'],
  sourceName: 'Nature Channel',
  category: { id: 'cat-animals', name: 'Animals', nameVi: 'Động vật', orderIndex: 0 },
};

const CARD_B: ListeningCard = {
  ...CARD_A,
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Ponyo Official Trailer',
  level: 'A2',
  durationMs: null,
  supportedModes: ['DICTATION'],
  category: { id: 'cat-movie', name: 'Movie', nameVi: 'Phim', orderIndex: 1 },
};

const catalogResponse = (
  items: ListeningCard[],
  total = items.length,
): ListeningCatalogResponse => ({
  data: items,
  meta: { total, page: 1, limit: 12, totalPages: Math.max(1, Math.ceil(total / 12)) },
  categories: [
    { id: 'cat-animals', name: 'Animals', nameVi: 'Động vật', orderIndex: 0, contentCount: 1 },
    { id: 'cat-movie', name: 'Movie', nameVi: 'Phim', orderIndex: 1, contentCount: 1 },
  ],
});

const renderCatalog = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/practice/listening']}>
          <ListeningCatalogPage />
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('Listening catalog — the four states never blend', () => {
  it('shows skeletons while loading, and no card text', async () => {
    let resolve: (value: ReturnType<typeof catalogResponse>) => void = () => {};
    mockedGetCatalog.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );

    renderCatalog();

    expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText(CARD_A.title)).not.toBeInTheDocument();

    resolve(catalogResponse([CARD_A]));
    await screen.findByText(CARD_A.title);
  });

  it('renders exactly the recordings the server returned', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A, CARD_B]) as never);

    renderCatalog();

    expect(await screen.findByText(CARD_A.title)).toBeInTheDocument();
    expect(screen.getByText(CARD_B.title)).toBeInTheDocument();
    // The deleted seed's titles can never appear again — there is no bundled
    // content left to fall back to.
    expect(screen.queryByText('Office Relocation Notice')).not.toBeInTheDocument();
    expect(screen.queryByText('Flight Delay Announcement')).not.toBeInTheDocument();
  });

  it('shows an explicit, retryable error — NOT an empty catalog', async () => {
    mockedGetCatalog.mockRejectedValue(new ApiError('Không tải được danh sách bài nghe', 500));

    renderCatalog();

    expect(await screen.findByText('Không tải được danh sách bài nghe')).toBeInTheDocument();
    // The empty-state wording must be absent: "nothing to learn" and "we could
    // not reach the server" are different facts.
    expect(
      screen.queryByText('No listening content is available yet.'),
    ).not.toBeInTheDocument();

    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A]) as never);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(CARD_A.title)).toBeInTheDocument();
  });

  it('never falls back to bundled content when the request fails', async () => {
    mockedGetCatalog.mockRejectedValue(new ApiError('offline', 503));

    renderCatalog();

    await screen.findByText('offline');
    // Scoped to card links: the surrounding student layout legitimately has
    // its own navigation links, and asserting "no links at all" would pass or
    // fail for reasons unrelated to the catalog.
    expect(screen.queryByRole('link', { name: /otter moms/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ponyo/i })).not.toBeInTheDocument();
  });

  it('shows an honest empty state when the server genuinely returns nothing', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([], 0) as never);

    renderCatalog();

    expect(
      await screen.findByText('No listening content is available yet.'),
    ).toBeInTheDocument();
  });
});

describe('Listening catalog — filters are server queries', () => {
  it('builds category chips from the response, with the server’s own counts', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A, CARD_B]) as never);

    renderCatalog();

    expect(await screen.findByRole('button', { name: 'Animals (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Movie (1)' })).toBeInTheDocument();
  });

  it('sends the chosen category to the API instead of filtering an array', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A, CARD_B]) as never);

    renderCatalog();
    fireEvent.click(await screen.findByRole('button', { name: 'Animals (1)' }));

    await waitFor(() =>
      expect(mockedGetCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoryId: 'cat-animals', page: 1 }),
      ),
    );
  });

  it('sends the chosen CEFR level to the API', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A]) as never);

    renderCatalog();
    fireEvent.click(await screen.findByRole('button', { name: 'B1' }));

    await waitFor(() =>
      expect(mockedGetCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ level: 'B1', page: 1 }),
      ),
    );
  });

  it('resets to page 1 when a filter changes, so a filtered view cannot open on a stale page', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A], 40) as never);

    renderCatalog();
    await screen.findByText(CARD_A.title);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(mockedGetCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Movie (1)' }));
    await waitFor(() =>
      expect(mockedGetCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })),
    );
  });
});

describe('Listening catalog — cards state only what is real', () => {
  it('links to the UUID route, not a slug', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A]) as never);

    renderCatalog();

    const link = await screen.findByRole('link', { name: /otter moms/i });
    expect(link).toHaveAttribute('href', `/practice/listening/${CARD_A.id}`);
  });

  it('shows no progress, percentage or completion claim — none exists yet', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_A, CARD_B]) as never);

    renderCatalog();
    await screen.findByText(CARD_A.title);

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/in progress/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('omits duration when the recording has none, rather than inventing one', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_B]) as never);

    renderCatalog();
    await screen.findByText(CARD_B.title);

    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it('advertises only the modes the recording actually enables', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD_B]) as never);

    renderCatalog();
    await screen.findByText(CARD_B.title);

    expect(screen.getByText('Dictation')).toBeInTheDocument();
    expect(screen.queryByText('Shadowing')).not.toBeInTheDocument();
  });
});

describe('Listening catalog — localisation', () => {
  it('renders Vietnamese copy when the language is switched', async () => {
    localStorage.setItem('language', 'vi');
    mockedGetCatalog.mockResolvedValue(catalogResponse([], 0) as never);

    renderCatalog();

    expect(await screen.findByText('Chưa có bài nghe nào.')).toBeInTheDocument();
    localStorage.removeItem('language');
  });
});
