import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import VocabLibraryPage from './VocabLibraryPage';

// Sprint 05 — this page already displayed a real `dueWords` count but linked
// nowhere, so a student could see "3 due" and have no way to act on it. It
// now carries its own review action, which required breaking the card out of
// a single wrapping <Link> (a <Link> cannot contain another <Link>) — the
// same restructure LibraryDetailPage's deck rows got in Sprint 04D.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const LIBRARY = {
  id: 'lib-1',
  name: 'TOEIC 600 Essential Words',
  description: '600 essential vocabulary words.',
  thumbnail: null,
  isPublished: true,
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const summary = (dueWords: number) => ({
  libraryId: 'lib-1',
  deckCount: 50,
  totalWords: 610,
  newWords: 600,
  learningWords: 5,
  reviewWords: 4,
  masteredWords: 1,
  dueWords,
  startedPercent: 1,
  masteredPercent: 0,
});

const buildFetch = (progress: unknown | null) =>
  vi.fn((url: string) => {
    if (url.includes('/learning/libraries/progress')) {
      return Promise.resolve(
        progress === null ? jsonResponse(500, { message: 'boom' }) : jsonResponse(200, { data: [progress] }),
      );
    }
    if (url.includes('/vocab/libraries')) return Promise.resolve(jsonResponse(200, { data: [LIBRARY] }));
    return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
  });

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/vocab']}>
          <Routes>
            <Route path="/vocab" element={<VocabLibraryPage />} />
            <Route path="/practice/review" element={<div>REVIEW_SESSION_STUB</div>} />
            <Route path="/vocab/libraries/:id" element={<div>LIBRARY_DETAIL_STUB</div>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VocabLibraryPage — review entry point (Sprint 05)', () => {
  it('shows a review action with the real due count when words are due', async () => {
    global.fetch = buildFetch(summary(3)) as unknown as typeof fetch;
    renderPage();

    const action = await screen.findByRole('link', { name: /review due words \(3\)/i });
    expect(action).toHaveAttribute('href', '/practice/review?libraryId=lib-1');
  });

  it('shows no review action when nothing is due', async () => {
    global.fetch = buildFetch(summary(0)) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('TOEIC 600 Essential Words');
    await waitFor(() => expect(screen.getByText(/610/)).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /review due words/i })).not.toBeInTheDocument();
  });

  it('shows no review action when the progress fetch fails', async () => {
    global.fetch = buildFetch(null) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('TOEIC 600 Essential Words');
    expect(screen.queryByRole('link', { name: /review due words/i })).not.toBeInTheDocument();
  });

  it('navigates to the review session, preserving the library scope', async () => {
    global.fetch = buildFetch(summary(3)) as unknown as typeof fetch;
    renderPage();

    await userEvent.click(await screen.findByRole('link', { name: /review due words \(3\)/i }));

    expect(await screen.findByText('REVIEW_SESSION_STUB')).toBeInTheDocument();
  });

  it('keeps the library name as its own link to the library detail page', async () => {
    global.fetch = buildFetch(summary(3)) as unknown as typeof fetch;
    renderPage();

    const nameLink = await screen.findByRole('link', { name: /TOEIC 600 Essential Words/ });
    expect(nameLink).toHaveAttribute('href', '/vocab/libraries/lib-1');
  });
});
