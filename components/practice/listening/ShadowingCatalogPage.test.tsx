import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import ShadowingCatalogPage from './ShadowingCatalogPage';
import {
  getListeningCatalog,
  getListeningProgress,
  getListeningShadowingProgress,
} from '../../../services/listeningService';
import type { ListeningCard, ListeningCatalogResponse } from '../../../services/listeningService';

vi.mock('../../../services/listeningService', () => ({
  getListeningCatalog: vi.fn(),
  getListeningProgress: vi.fn(),
  getListeningShadowingProgress: vi.fn(),
}));

const mockedGetCatalog = vi.mocked(getListeningCatalog);
const mockedGetProgress = vi.mocked(getListeningProgress);
const mockedGetShadowingProgress = vi.mocked(getListeningShadowingProgress);

// Sprint 11 — /practice/shadowing is ListeningCatalogPage with mode="SHADOWING"
// (see ShadowingCatalogPage.tsx and ListeningCatalogPage.tsx's own header
// comments). ListeningCatalogPage.test.tsx already pins the shared plumbing
// (the four states never blend, filters are server queries, cards state only
// what is real); this file only pins what actually DIFFERS for this mode —
// duplicating the whole suite would just be the same assertions twice.
const CARD: ListeningCard = {
  id: '33333333-3333-4333-8333-333333333333',
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

const catalogResponse = (items: ListeningCard[]): ListeningCatalogResponse => ({
  data: items,
  meta: { total: items.length, page: 1, limit: 12, totalPages: 1 },
  categories: [
    { id: 'cat-animals', name: 'Animals', nameVi: 'Động vật', orderIndex: 0, contentCount: 1 },
  ],
});

const renderShadowing = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/practice/shadowing']}>
          <ShadowingCatalogPage />
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ShadowingCatalogPage — the mode this page is for', () => {
  it('asks the server for the SHADOWING-filtered catalog', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD]) as never);

    renderShadowing();
    await screen.findByText(CARD.title);

    expect(mockedGetCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'SHADOWING' }),
    );
  });

  it('links straight into the Shadowing exercise, not the recording\'s default mode', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD]) as never);

    renderShadowing();

    const link = await screen.findByRole('link', { name: /otter moms/i });
    expect(link).toHaveAttribute('href', `/practice/listening/${CARD.id}/shadowing`);
  });

  it('shows Shadowing on the card, not Dictation, and reads shadowing progress only', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD]) as never);
    mockedGetShadowingProgress.mockResolvedValue([] as never);

    renderShadowing();
    const card = await screen.findByRole('link', { name: /otter moms/i });

    expect(within(card).getByText('Shadowing')).toBeInTheDocument();
    expect(within(card).queryByText('Dictation')).not.toBeInTheDocument();
    await waitFor(() => expect(mockedGetShadowingProgress).toHaveBeenCalledWith([CARD.id]));
    expect(mockedGetProgress).not.toHaveBeenCalled();
  });

  it('renders the server-computed Shadowing count on a started recording', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD]) as never);
    mockedGetShadowingProgress.mockResolvedValue([
      {
        contentId: CARD.id,
        shadowing: {
          totalSegments: 3,
          completedSegments: 1,
          completed: false,
          lastActivityAt: new Date().toISOString(),
        },
      },
    ] as never);

    renderShadowing();

    expect(await screen.findByText('1/3')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
  });

  it('draws no bar for a recording the student has never shadowed', async () => {
    mockedGetCatalog.mockResolvedValue(catalogResponse([CARD]) as never);
    mockedGetShadowingProgress.mockResolvedValue([
      {
        contentId: CARD.id,
        shadowing: { totalSegments: 3, completedSegments: 0, completed: false, lastActivityAt: null },
      },
    ] as never);

    renderShadowing();
    await screen.findByText(CARD.title);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
