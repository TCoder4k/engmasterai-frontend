import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import LessonPage from './LessonPage';

// Sprint 06 — Grammar lessons became a staged player (?stage=video|theory)
// with a five-tile stepper. Non-Grammar lessons must keep the original
// single-scroll layout, so Listening and Vocabulary do not inherit a flow
// built for grammar content.
//
// The YouTube embed is mocked: it loads a remote iframe API and is not what
// these tests are about.
vi.mock('./video/LessonVideoPlayer', () => ({
  default: () => <div data-testid="video-player">VIDEO_PLAYER</div>,
}));

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const USER = { id: 'user-1', name: 'Tu', email: 't@example.com', role: 'USER' };

const LESSON = {
  id: 'l-1',
  courseId: 'c-1',
  title: 'Present Perfect vs Past Simple',
  description: 'Tell the two apart in TOEIC Part 5.',
  notes: '## Rule 1 — Signal words\nUse Simple Past with "yesterday".\n\n## Rule 2\nUse Present Perfect with "since".',
  videoUrl: 'https://youtu.be/abc',
  pdfUrl: null,
  audioUrl: null,
  videoDurationMinutes: 18,
  estimatedStudyMinutes: 25,
  learningObjectives: ['Spot the signal words'],
  orderIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publishedTaskTypes: [],
};

const courseOf = (type: 'GRAMMAR' | 'LISTENING') => ({
  id: 'c-1',
  title: type === 'GRAMMAR' ? 'Grammar Fundamentals' : 'Listening Basics',
  type,
  description: 'A real course.',
  thumbnail: null,
  isPublished: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  _count: { lessons: 1 },
});

const buildFetch = (type: 'GRAMMAR' | 'LISTENING', lessonOver: Partial<typeof LESSON> = {}) => {
  const lesson = { ...LESSON, ...lessonOver };
  return vi.fn((url: string) => {
    // Sprint 06C — matched BEFORE '/lessons/l-1', which this path also
    // contains. hasSource: false is the honest default for a lesson nobody
    // has finished a quiz on, and it is what makes the tile read "Finish the
    // quiz first" rather than "Coming soon".
    if (url.includes('/trap-hunter')) {
      return Promise.resolve(
        jsonResponse(200, {
          traps: [],
          progress: { hasSource: false, total: 0, cleared: 0, completed: false },
        }),
      );
    }
    if (url.includes('/courses/c-1/lessons')) return Promise.resolve(jsonResponse(200, { data: [lesson] }));
    if (url.includes('/lessons/l-1')) return Promise.resolve(jsonResponse(200, lesson));
    if (url.includes('/courses/c-1')) return Promise.resolve(jsonResponse(200, courseOf(type)));
    return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
  });
};

// The stepper is queried through its own landmark: "Theory cards" also
// appears inside the video stage's CTA copy, and "Coming soon" appears in
// the layout sidebar's level widget, so unscoped queries are ambiguous.
const stepper = () => within(screen.getByRole('list', { name: 'Lesson stages' }));

const renderPage = (search = '') =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[`/courses/c-1/lessons/l-1${search}`]}>
          <Routes>
            <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
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

describe('LessonPage — Grammar staged player', () => {
  it('renders the five-stage stepper and starts on the video stage', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('Present Perfect vs Past Simple')).toBeInTheDocument();
    expect(stepper().getByText('Video lesson')).toBeInTheDocument();
    expect(stepper().getByText('Quiz Part 5')).toBeInTheDocument();
    expect(screen.getByTestId('video-player')).toBeInTheDocument();
  });

  it('renders the theory stage directly from the URL, so a refresh lands where the student was', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage('?stage=theory');

    // Body text is unique to the rendered theory content — the heading
    // itself legitimately appears twice (outline + content card).
    expect(await screen.findByText(/Use Simple Past with "yesterday"/)).toBeInTheDocument();
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
  });

  it('switches stage when a stepper tile is clicked', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    await screen.findByTestId('video-player');
    await userEvent.click(stepper().getByRole('button', { name: /Theory cards/ }));

    expect(await screen.findByText(/Use Simple Past with "yesterday"/)).toBeInTheDocument();
  });

  it('marks the theory stage complete only after an explicit action', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage('?stage=theory');

    await screen.findByText(/Use Simple Past with "yesterday"/);
    expect(screen.queryByText('Theory marked as read')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /I've finished reading/i }));

    expect(await screen.findByText('Theory marked as read')).toBeInTheDocument();
    expect(localStorage.getItem(`lessonStages:${USER.id}:l-1`)).toContain('theoryCompletedAt');
  });

  it('reflects a previously completed video in the stepper', async () => {
    localStorage.setItem(
      `videoProgress:${USER.id}:l-1`,
      JSON.stringify({
        courseId: 'c-1',
        resolvedLessonPath: '/courses/c-1/lessons/l-1',
        youtubeVideoId: 'abc',
        positionSeconds: 1080,
        durationSeconds: 1080,
        lastUpdatedAt: '2026-07-26T00:00:00.000Z',
        ended: true,
      }),
    );
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage();

    await screen.findByTestId('video-player');
    expect(stepper().getByText('Completed')).toBeInTheDocument();
  });

  it('falls back to the video stage when the lesson has no published quiz', async () => {
    global.fetch = buildFetch('GRAMMAR') as unknown as typeof fetch;
    renderPage('?stage=quiz');

    // This fixture's _count.tasks is 0 — no quiz exists for it — so
    // requesting ?stage=quiz falls back to Video rather than rendering
    // nothing (Sprint 06B).
    //
    // Sprint 06D removed the last "Coming soon" from this page: every stage
    // now has a real module, so no tile is constant-locked. This lesson has
    // no quiz (and therefore no mistakes to correct) and no practice task,
    // so all three of Quiz / Trap Hunter / Advanced Practice honestly read
    // "Not in this lesson".
    expect(await screen.findByTestId('video-player')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(stepper().queryAllByText('Coming soon')).toHaveLength(0);
    expect(stepper().getAllByText('Not in this lesson')).toHaveLength(3);
  });

  // Sprint 06C — the tile a student sees before they have finished a quiz.
  // It must never claim a shipped feature is unbuilt.
  it('shows Trap Hunter as blocked — not "Coming soon" — on a lesson that HAS a quiz', async () => {
    global.fetch = buildFetch('GRAMMAR', { publishedTaskTypes: ['QUIZ'] }) as unknown as typeof fetch;
    renderPage();

    await screen.findByTestId('video-player');
    expect(stepper().getByText('Finish the quiz first')).toBeInTheDocument();
    // Sprint 06D — nothing on this page says "Coming soon" any more. This
    // lesson has a quiz but no practice task, so Advanced Practice reads
    // "Not in this lesson" rather than claiming to be unbuilt.
    expect(stepper().queryAllByText('Coming soon')).toHaveLength(0);
    expect(stepper().getAllByText('Not in this lesson')).toHaveLength(1);
  });
});

describe('LessonPage — Sprint 06B quiz stage', () => {
  const LESSON_WITH_QUIZ = { ...LESSON, publishedTaskTypes: ['QUIZ'] };

  const QUIZ_RESPONSE = {
    quiz: {
      taskId: 'task-1',
      passingScorePercent: 70,
      questions: [
        {
          id: 'q-1',
          type: 'MULTIPLE_CHOICE',
          difficulty: null,
          content: 'She ___ to work every day.',
          options: [
            { id: 'a', text: 'go' },
            { id: 'b', text: 'goes' },
          ],
          audioUrl: null,
          imageUrl: null,
          orderIndex: 0,
        },
      ],
    },
    progress: { attemptsCount: 0, bestScorePercent: null, passed: false, lastDurationSeconds: null },
  };

  const buildFetchWithQuiz = () =>
    vi.fn((url: string) => {
      if (url.includes('/quiz/submit')) {
        return Promise.resolve(
          jsonResponse(201, {
            correctCount: 1,
            totalCount: 1,
            accuracyPercent: 100,
            passed: true,
            passingScorePercent: 70,
            attemptsCount: 1,
            bestScorePercent: 100,
            durationSeconds: 12,
            results: [
              {
                questionId: 'q-1',
                isCorrect: true,
                submitted: { optionId: 'b' },
                correctAnswer: { optionId: 'b' },
                explanation: null,
              },
            ],
          }),
        );
      }
      if (url.includes('/quiz')) return Promise.resolve(jsonResponse(200, QUIZ_RESPONSE));
      if (url.includes('/courses/c-1/lessons')) {
        return Promise.resolve(jsonResponse(200, { data: [LESSON_WITH_QUIZ] }));
      }
      if (url.includes('/lessons/l-1')) return Promise.resolve(jsonResponse(200, LESSON_WITH_QUIZ));
      if (url.includes('/courses/c-1')) return Promise.resolve(jsonResponse(200, courseOf('GRAMMAR')));
      return Promise.resolve(jsonResponse(404, { message: 'Not found' }));
    });

  it('renders the quiz question and lets the student answer, submit, and reach Lesson Complete', async () => {
    global.fetch = buildFetchWithQuiz() as unknown as typeof fetch;
    renderPage('?stage=quiz');

    expect(await screen.findByText('She ___ to work every day.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /goes/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /goes/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Quiz summary')).toBeInTheDocument();
    expect(screen.getByText("You've passed this quiz.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Lesson complete')).toBeInTheDocument();
  });
});

describe('LessonPage — non-Grammar lessons are unchanged', () => {
  it('keeps the single-scroll layout with no stage stepper', async () => {
    global.fetch = buildFetch('LISTENING') as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('Present Perfect vs Past Simple')).toBeInTheDocument();
    expect(screen.getByTestId('video-player')).toBeInTheDocument();
    // The five-stage vocabulary belongs to Grammar only.
    expect(screen.queryByRole('list', { name: 'Lesson stages' })).not.toBeInTheDocument();
    expect(screen.queryByText('Quiz Part 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Trap Hunter')).not.toBeInTheDocument();
    // The original lightweight stepper is still there.
    expect(screen.getByText('Mini check (soon)')).toBeInTheDocument();
  });
});
