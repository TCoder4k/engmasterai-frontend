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

const course = (id: string, title: string, lessons: number) => ({
  id,
  title,
  type: 'GRAMMAR' as const,
  description: `Description for ${title}`,
  thumbnail: null,
  isPublished: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  _count: { lessons },
});

const MOCK_COURSES = [
  course('c-1', 'Grammar Fundamentals', 2),
  course('c-2', 'TOEIC Grammar Mastery', 1),
  course('c-3', 'Relative Clauses Deep Dive', 1),
];

const lessonOf = (id: string, courseId: string, minutes: number) => ({
  id,
  courseId,
  title: `Lesson ${id}`,
  description: null,
  notes: null, // video-only, so finishing the video completes the lesson
  videoUrl: 'https://youtu.be/abc',
  pdfUrl: null,
  audioUrl: null,
  videoDurationMinutes: minutes,
  estimatedStudyMinutes: minutes,
  learningObjectives: [],
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publishedTaskTypes: [],
});

const LESSONS: Record<string, ReturnType<typeof lessonOf>[]> = {
  'c-1': [lessonOf('l-1', 'c-1', 30), lessonOf('l-2', 'c-1', 25)],
  'c-2': [lessonOf('l-3', 'c-2', 40)],
  'c-3': [lessonOf('l-4', 'c-3', 10)],
};

const seedCompletedVideo = (lessonId: string) =>
  localStorage.setItem(
    `videoProgress:${USER.id}:${lessonId}`,
    JSON.stringify({
      courseId: 'c-1',
      resolvedLessonPath: `/courses/c-1/lessons/${lessonId}`,
      youtubeVideoId: 'abc',
      positionSeconds: 100,
      durationSeconds: 100,
      lastUpdatedAt: '2026-07-26T00:00:00.000Z',
      ended: true,
    }),
  );

const buildFetch = (courses: unknown[] | null, lessonsOk = true) =>
  vi.fn((url: string) => {
    const lessonMatch = url.match(/\/courses\/(c-\d)\/lessons/);
    if (lessonMatch) {
      return Promise.resolve(
        lessonsOk
          ? jsonResponse(200, { data: LESSONS[lessonMatch[1]] ?? [] })
          : jsonResponse(500, { message: 'boom' }),
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

  it('shows real total duration once the lesson fetches resolve', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    // c-1 = 30 + 25 real study minutes.
    expect(await screen.findByText('55 min')).toBeInTheDocument();
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

  it('still renders every card when the lesson fetches fail', async () => {
    global.fetch = buildFetch(MOCK_COURSES, false) as unknown as typeof fetch;
    renderPage();

    // Supplementary data degrades silently: titles and lesson counts stay,
    // duration and progress simply do not appear.
    expect(await screen.findByText('Grammar Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('2 lessons')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('55 min')).not.toBeInTheDocument());
  });

  it('links each card to the existing course detail route', async () => {
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
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

  it('renders real completion once lessons are finished, with the device caption', async () => {
    seedCompletedVideo('l-1'); // 1 of c-1's 2 video-only lessons
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Grammar Fundamentals');
    expect(await screen.findByText('1/2 (50%)')).toBeInTheDocument();
    // Never presented as server-backed progress.
    expect(screen.getAllByText('Tracked on this device').length).toBeGreaterThan(0);
  });

  it('never claims XP, streaks or accuracy', async () => {
    seedCompletedVideo('l-1');
    global.fetch = buildFetch(MOCK_COURSES) as unknown as typeof fetch;
    const { container } = renderPage();

    await screen.findByText('Grammar Fundamentals');
    expect(container.textContent).not.toMatch(/XP/i);
    expect(container.textContent).not.toMatch(/streak/i);
    expect(container.textContent).not.toMatch(/accuracy/i);
  });
});
