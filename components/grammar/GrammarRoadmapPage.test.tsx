import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import GrammarRoadmapPage from './GrammarRoadmapPage';

// Sprint 06 — /grammar is the Grammar ROADMAP. It reuses GET /courses with
// its server-side type filter and fetches each course's lessons so duration
// and progress are real.
//
// The load-bearing honesty assertions: no percentage may appear when the
// student has no local completion history, and progress must always carry
// its device-local caption.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const USER = { id: 'user-1', name: 'Tu', email: 't@example.com', role: 'USER' };

// Sprint 08 — totalEstimatedMinutes arrives WITH the course, so the roadmap no
// longer fetches every lesson of every course just to add up durations.
const course = (id: string, title: string, lessons: number, minutes = 0) => ({
  id,
  title,
  type: 'GRAMMAR' as const,
  description: `Description for ${title}`,
  thumbnail: null,
  isPublished: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  _count: { lessons },
  totalEstimatedMinutes: minutes,
});

const MOCK_COURSES = [
  course('c-1', 'Grammar Fundamentals', 2, 55),
  course('c-2', 'TOEIC Grammar Mastery', 1, 40),
  course('c-3', 'Relative Clauses Deep Dive', 1, 10),
];

// Sprint 08 — one summary per course from GET /progress/courses. Completion is
// derived on the SERVER, so a test declares the outcome rather than composing
// stage rows and hoping the client rolls them up the same way.
const courseSummary = (
  courseId: string,
  totalLessons: number,
  completedLessons: number,
  overrides: { status?: string; inProgressLessons?: number } = {},
) => ({
  courseId,
  totalLessons,
  completedLessons,
  inProgressLessons: overrides.inProgressLessons ?? 0,
  notStartedLessons:
    totalLessons - completedLessons - (overrides.inProgressLessons ?? 0),
  progressPercent:
    totalLessons === 0 ? 0 : Math.floor((completedLessons / totalLessons) * 100),
  status:
    overrides.status ??
    (totalLessons > 0 && completedLessons === totalLessons
      ? 'COMPLETED'
      : completedLessons > 0 || (overrides.inProgressLessons ?? 0) > 0
        ? 'IN_PROGRESS'
        : 'NOT_STARTED'),
  continueLessonId: 'l-1',
  lessons: null,
});

const NOTHING_DONE = [
  courseSummary('c-1', 2, 0),
  courseSummary('c-2', 1, 0),
  courseSummary('c-3', 1, 0),
];

const buildFetch = (
  courses: unknown[] | null,
  progress: ReturnType<typeof courseSummary>[] | null = NOTHING_DONE,
) =>
  vi.fn((url: string) => {
    // Matched BEFORE the generic '/courses' branch below.
    if (url.includes('/progress/courses')) {
      return Promise.resolve(
        progress === null
          ? jsonResponse(500, { message: 'boom' })
          : jsonResponse(200, progress),
      );
    }
    if (url.includes('/courses')) {
      return Promise.resolve(
        courses === null ? jsonResponse(500, { message: 'boom' }) : jsonResponse(200, { data: courses }),
      );
    }
    return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
  });

const renderPage = () =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/grammar']}>
          <Routes>
            <Route path="/grammar" element={<GrammarRoadmapPage />} />
            <Route path="/courses/:id" element={<div>COURSE_DETAIL_STUB</div>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify(USER));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('GrammarRoadmapPage — data', () => {
  it('requests only published GRAMMAR courses', async () => {
    const fetchMock = buildFetch(MOCK_COURSES);
    global.fetch = fetchMock as unknown as typeof fetch;
    renderPage();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toContain('type=GRAMMAR');
  });

  it('renders real course data and real lesson counts', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('Grammar Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('TOEIC Grammar Mastery')).toBeInTheDocument();
    expect(await screen.findByText('2 lessons')).toBeInTheDocument();
  });

  it('shows real total duration from the course response, with no lesson fetch', async () => {
    const fetchMock = buildFetch(MOCK_COURSES);
    global.fetch = fetchMock as unknown as typeof fetch;
    renderPage();

    // c-1 = 30 + 25 real study minutes, summed server-side.
    expect(await screen.findByText('55 min')).toBeInTheDocument();
    // Sprint 08 — the roadmap issued one lessons request PER COURSE to compute
    // this. That loop is gone; the number arrives with the course.
    expect(
      fetchMock.mock.calls.filter(([url]) => /\/courses\/c-\d\/lessons/.test(url as string)),
    ).toHaveLength(0);
  });

  it('issues exactly ONE progress request for the whole roadmap', async () => {
    // The N+1 this sprint removed: three courses used to mean six requests
    // (lessons + progress each), and the count grew with the catalog.
    const fetchMock = buildFetch(MOCK_COURSES);
    global.fetch = fetchMock as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Grammar Fundamentals');
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          (url as string).includes('/progress/courses'),
        ),
      ).toHaveLength(1),
    );
  });

  it('shows an error state when the course request fails', async () => {
    global.fetch = buildFetch(null) as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('Grammar Fundamentals')).not.toBeInTheDocument();
  });

  it('shows an honest empty state when nothing is published', async () => {
    global.fetch = buildFetch([]) as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('No grammar courses have been published yet.')).toBeInTheDocument();
  });

  it('still renders every card when the progress request fails', async () => {
    global.fetch = buildFetch(MOCK_COURSES, null) as unknown as typeof fetch;
    renderPage();

    // Supplementary data degrades silently: titles, lesson counts and duration
    // all come from the course response and stay. Only the status is missing —
    // and crucially, no percentage is invented in its place.
    expect(await screen.findByText('Grammar Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('2 lessons')).toBeInTheDocument();
    expect(screen.getByText('55 min')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/%/)).not.toBeInTheDocument());
  });

  it('links each card to the existing course detail route', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    const link = await screen.findByRole('link', { name: /Grammar Fundamentals/ });
    expect(link).toHaveAttribute('href', '/courses/c-1');
  });

  it('links an IN_PROGRESS card to the lesson list, never straight into continueLessonId', async () => {
    // The roadmap grid is an overview surface — even a "Học tiếp" card must
    // land on the course's lesson list so the learner can pick freely,
    // rather than being dropped straight into whichever lesson is next.
    global.fetch = buildFetch(MOCK_COURSES, [
      courseSummary('c-1', 2, 1, { status: 'IN_PROGRESS' }),
      courseSummary('c-2', 1, 0),
      courseSummary('c-3', 1, 0),
    ]) as unknown as typeof fetch;
    renderPage();

    const link = await screen.findByRole('link', { name: /Grammar Fundamentals/ });
    expect(link).toHaveAttribute('href', '/courses/c-1');
  });
});

describe('GrammarRoadmapPage — no search input (Sprint 06 decision)', () => {
  it('renders no search box', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Grammar Fundamentals');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});

describe('GrammarRoadmapPage — collection filter', () => {
  it('renders a chip only for collections present in the data', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Grammar Fundamentals');
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Foundation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TOEIC' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Destination' })).not.toBeInTheDocument();
  });

  it('filters the grid to the selected collection', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Grammar Fundamentals');
    await userEvent.click(screen.getByRole('button', { name: 'TOEIC' }));

    expect(screen.getByText('TOEIC Grammar Mastery')).toBeInTheDocument();
    expect(screen.queryByText('Grammar Fundamentals')).not.toBeInTheDocument();
  });

  it('keeps a course with no derived collection visible under All', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('Relative Clauses Deep Dive')).toBeInTheDocument();
  });
});

describe('GrammarRoadmapPage — progress is real or absent', () => {
  it('renders NO percentage at all when nothing has been completed', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    const { container } = renderPage();

    await screen.findByText('Grammar Fundamentals');
    await waitFor(() => expect(screen.getByText('55 min')).toBeInTheDocument());

    expect(container.textContent).not.toMatch(/%/);
    expect(screen.queryByText('Tracked on this device')).not.toBeInTheDocument();
  });

  it('renders real completion once lessons are finished', async () => {
    // 1 of c-1's 2 lessons, as the SERVER reports it.
    global.fetch = buildFetch(MOCK_COURSES, [
      courseSummary('c-1', 2, 1),
      courseSummary('c-2', 1, 0),
      courseSummary('c-3', 1, 0),
    ]) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Grammar Fundamentals');
    expect(await screen.findByText('1/2 (50%)')).toBeInTheDocument();
    // Sprint 07 — the caption changed with the fact it describes. Progress is
    // no longer device-local, so claiming it was would be the same kind of
    // inaccuracy the old caption existed to avoid, in reverse.
    expect(screen.getAllByText('Saved to your account').length).toBeGreaterThan(0);
  });

  it('never claims XP, streaks or accuracy', async () => {
    global.fetch = buildFetch(MOCK_COURSES, [
      courseSummary('c-1', 2, 1),
    ]) as unknown as typeof fetch;
    const { container } = renderPage();

    await screen.findByText('Grammar Fundamentals');
    expect(container.textContent).not.toMatch(/XP/i);
    expect(container.textContent).not.toMatch(/streak/i);
    expect(container.textContent).not.toMatch(/accuracy/i);
  });
});
