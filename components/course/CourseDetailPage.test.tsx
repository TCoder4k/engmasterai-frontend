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
    publishedTaskTypes: [],
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
    publishedTaskTypes: [],
  },
];

// Sprint 08 — GET /progress/courses. The page no longer receives raw stage
// rows to roll up; the server sends the derived per-lesson status and the
// course summary, and this page renders them.
type LessonStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_CONTENT';

const summary = (statuses: LessonStatus[]) => {
  const countable = statuses.filter((s) => s !== 'NO_CONTENT');
  const completed = countable.filter((s) => s === 'COMPLETED').length;
  const inProgress = countable.filter((s) => s === 'IN_PROGRESS').length;
  return {
    courseId: 'c-1',
    totalLessons: countable.length,
    completedLessons: completed,
    inProgressLessons: inProgress,
    notStartedLessons: countable.length - completed - inProgress,
    progressPercent:
      countable.length === 0 ? 0 : Math.floor((completed / countable.length) * 100),
    status:
      countable.length > 0 && completed === countable.length
        ? 'COMPLETED'
        : completed > 0 || inProgress > 0
          ? 'IN_PROGRESS'
          : 'NOT_STARTED',
    continueLessonId: 'l-1',
    lessons: statuses.map((status, i) => ({
      lessonId: `l-${i + 1}`,
      orderIndex: i,
      status,
    })),
  };
};

const buildFetch = (
  type: 'GRAMMAR' | 'VOCABULARY',
  lessons = LESSONS,
  progress: ReturnType<typeof summary>[] = [summary(['NOT_STARTED', 'NOT_STARTED'])],
  options: { progressFails?: boolean } = {},
) =>
  vi.fn((url: string) => {
    // Matched BEFORE '/courses/c-1' — this path contains "courses" too.
    if (url.includes('/progress/courses')) {
      return options.progressFails
        ? Promise.resolve(jsonResponse(500, { message: 'boom' }))
        : Promise.resolve(jsonResponse(200, progress));
    }
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

  it('shows every lesson as ready to learn before anything is completed', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(await screen.findAllByText('Ready to learn')).toHaveLength(2);
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    // NOT_STARTED offers "Start", not "Continue".
    expect(screen.getAllByText('Start')).toHaveLength(2);
  });

  it('reflects real SERVER-SIDE status in the lesson list and the hero', async () => {
    // Sprint 08 — the status is DERIVED ON THE SERVER. This page does not roll
    // stages up any more, which is what makes the lesson page and the course
    // page incapable of disagreeing.
    global.fetch = buildFetch('GRAMMAR', LESSONS, [
      summary(['COMPLETED', 'NOT_STARTED']),
    ]) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    // A finished lesson invites review, not a restart.
    expect(screen.getByText('Review again')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('50% (1/2)')).toBeInTheDocument();
    expect(screen.getByText('Saved to your account')).toBeInTheDocument();
  });

  it('offers "Continue" for a lesson that is started but unfinished', async () => {
    global.fetch = buildFetch('GRAMMAR', LESSONS, [
      summary(['IN_PROGRESS', 'NOT_STARTED']),
    ]) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
    // 0% completed, but the student has a place to return to — the case a
    // percentage-driven CTA gets wrong.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('marks a lesson with no completable content instead of calling it unstarted', async () => {
    global.fetch = buildFetch('GRAMMAR', LESSONS, [
      summary(['COMPLETED', 'NO_CONTENT']),
    ]) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(await screen.findByText('No content yet')).toBeInTheDocument();
    // The NO_CONTENT lesson is out of the totals, so the course IS finished.
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByText('100% (1/1)')).toBeInTheDocument();
  });

  it('says so when progress fails, instead of claiming nothing was started', async () => {
    // The Sprint 08 fix for a real silent failure: every progress .catch() used
    // to set an empty map, which rendered as every lesson not-yet-started. A
    // student half-way through a course was told they had done none of it.
    global.fetch = buildFetch('GRAMMAR', LESSONS, [], {
      progressFails: true,
    }) as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(await screen.findAllByText('Progress unavailable')).not.toHaveLength(0);
    expect(screen.queryByText('Ready to learn')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('ignores forged localStorage progress', async () => {
    // Before Sprint 07 this key WAS the authority for the video stage, so
    // writing it by hand moved the course percentage with no server involved.
    // Sprint 08 makes it structurally impossible: the number is not computed
    // here at all.
    localStorage.setItem(
      `videoProgress:${USER.id}:l-1`,
      JSON.stringify({ positionSeconds: 900, durationSeconds: 900, ended: true }),
    );
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    await screen.findByText('Present Simple');
    expect(await screen.findAllByText('Ready to learn')).toHaveLength(2);
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
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
