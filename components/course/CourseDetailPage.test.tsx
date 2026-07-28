import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import CourseDetailPage from './CourseDetailPage';

// Sprint 05 — Grammar is a student-facing module, so a Grammar course must
// return to /grammar rather than the generic /courses catalog; everything
// else still goes back to /courses. Course/Lesson themselves are unchanged:
// one Course domain, one detail route.
//
// The honesty assertions here mirror the landing page's: no completion
// status, no accuracy, no XP and no course progress bar, because
// LessonTask/Question/LessonTaskProgress have no API at all.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const USER = { id: 'user-1', name: 'Tu', email: 't@example.com', role: 'USER' };

const courseOf = (type: 'GRAMMAR' | 'VOCABULARY') => ({
  id: 'c-1',
  title: type === 'GRAMMAR' ? 'Grammar Fundamentals' : 'Vocabulary Basics',
  type,
  description: 'A real course description.',
  thumbnail: null,
  isPublished: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  _count: { lessons: 2 },
});

const LESSONS = [
  {
    id: 'l-1',
    courseId: 'c-1',
    title: 'Present Simple',
    description: 'The basics',
    notes: null,
    videoUrl: 'https://youtu.be/abc',
    pdfUrl: null,
    audioUrl: null,
    videoDurationMinutes: 7,
    estimatedStudyMinutes: 15,
    learningObjectives: [],
    orderIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { tasks: 0 },
  },
  {
    id: 'l-2',
    courseId: 'c-1',
    title: 'Present Continuous',
    description: null,
    notes: null,
    videoUrl: 'https://youtu.be/def',
    pdfUrl: null,
    audioUrl: null,
    videoDurationMinutes: 6,
    estimatedStudyMinutes: 10,
    learningObjectives: [],
    orderIndex: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { tasks: 0 },
  },
];

const buildFetch = (type: 'GRAMMAR' | 'VOCABULARY', lessons = LESSONS) =>
  vi.fn((url: string) => {
    if (url.includes('/lessons')) return Promise.resolve(jsonResponse(200, { data: lessons }));
    if (url.includes('/courses/c-1')) return Promise.resolve(jsonResponse(200, courseOf(type)));
    if (url.includes('/courses/missing')) {
      return Promise.resolve(jsonResponse(404, { message: 'Course with ID missing not found' }));
    }
    return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
  });

const renderPage = (path = '/courses/c-1') =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/courses/:id" element={<CourseDetailPage />} />
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

describe('CourseDetailPage — module-aware back link (Sprint 05)', () => {
  it('returns a GRAMMAR course to the Grammar roadmap', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    const back = await screen.findByRole('link', { name: /back to grammar roadmap/i });
    expect(back).toHaveAttribute('href', '/grammar');
  });

  it('returns a non-Grammar course to the generic catalog', async () => {
    global.fetch = buildFetch('VOCABULARY') as unknown as typeof fetch;
    renderPage();

    const back = await screen.findByRole('link', { name: /back to courses/i });
    expect(back).toHaveAttribute('href', '/courses');
  });
});

describe('CourseDetailPage — real data only', () => {
  it('renders the real lesson list with real study times', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('Present Simple')).toBeInTheDocument();
    expect(screen.getByText('Present Continuous')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Present Simple/ })).toHaveAttribute(
      'href',
      '/courses/c-1/lessons/l-1',
    );
    // 15 + 10 real minutes in the hero stat tile.
    expect(screen.getByText(/^25$/)).toBeInTheDocument();
  });

  it('shows every lesson as not started before anything is completed', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(screen.getAllByText('Not started')).toHaveLength(2);
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('reflects real device-local completion in the lesson list and the hero', async () => {
    // Both fixture lessons are video-only (notes: null), so a finished video
    // completes them.
    localStorage.setItem(
      `videoProgress:${USER.id}:l-1`,
      JSON.stringify({
        courseId: 'c-1',
        resolvedLessonPath: '/courses/c-1/lessons/l-1',
        youtubeVideoId: 'abc',
        positionSeconds: 900,
        durationSeconds: 900,
        lastUpdatedAt: '2026-07-26T00:00:00.000Z',
        ended: true,
      }),
    );
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('50% (1/2)')).toBeInTheDocument();
    expect(screen.getByText('Tracked on this device')).toBeInTheDocument();
  });

  it('shows an error state for an unknown course', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage('/courses/missing');

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it('shows an honest empty state for a course with no published lessons', async () => {
    global.fetch = buildFetch('GRAMMAR', []) as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('No lessons in this course yet.')).toBeInTheDocument();
  });

  // Sprint 06 changed this assertion DELIBERATELY. It used to forbid any
  // "%" or "completed" on the page, which was correct while no progress
  // existed at all. Progress is now real (device-local completed lessons),
  // so the guard moves to what remains fabricated — XP and accuracy — plus
  // the rule that a percentage must never appear without real data behind
  // it, which the "before anything is completed" test above pins down.
  it('claims no XP or accuracy, and no percentage without real progress', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    const { container } = renderPage();

    await screen.findByText('Present Simple');
    expect(container.textContent).not.toMatch(/XP/i);
    expect(container.textContent).not.toMatch(/accuracy/i);
    expect(container.textContent).not.toMatch(/streak/i);
    // Nothing completed in this test's localStorage, so no percentage.
    expect(container.textContent).not.toMatch(/%/);
  });
});
