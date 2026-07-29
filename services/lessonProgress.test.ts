import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  availableStages,
  clearLessonStages,
  getCourseProgress,
  getStageStatus,
  isLessonComplete,
  isLessonStarted,
  markTheoryComplete,
  QuizStageProgress,
  TrapHunterStageProgress,
} from './lessonProgress';
import { VideoProgressEntry } from './videoProgress';

// Sprint 06 — these tests pin down the decision the whole sprint rests on:
// progress counts COMPLETED LESSONS, not watched videos. A Lesson is
// becoming Video -> Theory -> Mini Check -> Practice, so if the unit were
// "video watched", every stage added later would break the progress UI.
// `isLessonComplete` is the seam a real backend will replace, and the
// assertions below are what keep it honest in the meantime.
//
// Sprint 06B: 'quiz' left the always-locked set and gained a real,
// server-backed status — see the dedicated describe block below. Every
// fixture here defaults to `_count.tasks: 0` (no quiz), so every
// pre-existing assertion in this file keeps meaning exactly what it did
// before quiz existed.

const USER = 'user-1';

const lesson = (
  over: Partial<{ id: string; videoUrl: string | null; notes: string | null; _count: { tasks: number } }> = {},
) => ({
  id: 'l-1',
  videoUrl: 'https://youtu.be/abc',
  notes: '## Rule one\nBody text',
  _count: { tasks: 0 },
  ...over,
});

// Sprint 06C fixtures. `hasSource: true` is the default because it is the
// interesting case — a completed quiz attempt exists, and what varies is how
// many mistakes it produced.
const trapProgress = (
  over: Partial<TrapHunterStageProgress> = {},
): TrapHunterStageProgress => ({
  hasSource: true,
  total: 2,
  cleared: 0,
  ...over,
});

const quizPassed: QuizStageProgress = { passed: true, attemptsCount: 1 };

const seedVideo = (lessonId: string, entry: Partial<VideoProgressEntry>) =>
  localStorage.setItem(
    `videoProgress:${USER}:${lessonId}`,
    JSON.stringify({
      courseId: 'c-1',
      resolvedLessonPath: `/courses/c-1/lessons/${lessonId}`,
      youtubeVideoId: 'abc',
      positionSeconds: 0,
      durationSeconds: 600,
      lastUpdatedAt: '2026-07-26T00:00:00.000Z',
      ended: false,
      ...entry,
    }),
  );

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('availableStages', () => {
  it('lists only the stages the lesson actually has content for', () => {
    expect(availableStages(lesson())).toEqual(['video', 'theory']);
    expect(availableStages(lesson({ notes: null }))).toEqual(['video']);
    expect(availableStages(lesson({ videoUrl: null }))).toEqual(['theory']);
    expect(availableStages(lesson({ videoUrl: null, notes: null }))).toEqual([]);
  });

  it('never includes a stage that has no backend at all', () => {
    // 'practice' (Advanced Practice) needs a module that does not exist yet.
    // Requiring it would make every lesson permanently incomplete. Quiz
    // (Sprint 06B) and Trap Hunter (Sprint 06C) are different: they DO have
    // backends now, so each has its own test below.
    expect(availableStages(lesson())).not.toContain('practice');
    expect(availableStages(lesson({ _count: { tasks: 1 } }), trapProgress())).not.toContain(
      'practice',
    );
  });

  it('includes quiz only when the lesson actually has a published one', () => {
    expect(availableStages(lesson())).not.toContain('quiz');
    expect(availableStages(lesson({ _count: { tasks: 1 } }))).toContain('quiz');
  });

  it('treats whitespace-only notes as no theory content', () => {
    expect(availableStages(lesson({ notes: '   \n  ' }))).toEqual(['video']);
  });
});

describe('getStageStatus — video, derived from the existing resume store', () => {
  it('is not_started with no stored progress', () => {
    expect(getStageStatus(USER, lesson(), 'video')).toBe('not_started');
  });

  it('is in_progress once the video has been played at all', () => {
    seedVideo('l-1', { positionSeconds: 42 });
    expect(getStageStatus(USER, lesson(), 'video')).toBe('in_progress');
  });

  it('is completed when the video ended', () => {
    seedVideo('l-1', { positionSeconds: 599, ended: true });
    expect(getStageStatus(USER, lesson(), 'video')).toBe('completed');
  });

  it('is unavailable — not not_started — when the lesson has no video', () => {
    expect(getStageStatus(USER, lesson({ videoUrl: null }), 'video')).toBe('unavailable');
  });
});

describe('getStageStatus — theory', () => {
  it('is not_started until explicitly marked read', () => {
    expect(getStageStatus(USER, lesson(), 'theory')).toBe('not_started');
    markTheoryComplete(USER, 'l-1');
    expect(getStageStatus(USER, lesson(), 'theory')).toBe('completed');
  });

  it('is unavailable when the lesson has no notes', () => {
    expect(getStageStatus(USER, lesson({ notes: null }), 'theory')).toBe('unavailable');
  });
});

describe('getStageStatus — stages with no backend are always locked', () => {
  it('practice is locked', () => {
    expect(getStageStatus(USER, lesson(), 'practice')).toBe('locked');
  });

  it('stays locked even if storage is hand-edited to claim completion', () => {
    // The status is a constant, never read from storage, so no stale or
    // tampered localStorage can make an unbuilt stage look finished.
    localStorage.setItem(
      `lessonStages:${USER}:l-1`,
      JSON.stringify({ theoryCompletedAt: 'x', quizCompletedAt: 'x', practiceCompletedAt: 'x' }),
    );
    expect(getStageStatus(USER, lesson(), 'practice')).toBe('locked');
  });

  // Sprint 06C did not touch Advanced Practice, and this is what says so.
  // Trap Hunter shipping must not have unlocked, renamed or implemented the
  // stage after it — it is reserved for Sprint 06D.
  it('stays locked in every state Trap Hunter can be in', () => {
    const withQuiz = lesson({ _count: { tasks: 1 } });
    const states: (TrapHunterStageProgress | undefined)[] = [
      undefined,
      trapProgress({ hasSource: false }),
      trapProgress({ total: 0 }),
      trapProgress({ total: 2, cleared: 0 }),
      trapProgress({ total: 2, cleared: 2 }),
    ];
    states.forEach((state) => {
      expect(getStageStatus(USER, withQuiz, 'practice', quizPassed, state)).toBe('locked');
    });
  });
});

// Sprint 06B — quiz is real now. lessonHasQuiz reads `_count.tasks`
// (the backend's published-QUIZ-task count), and quizProgress comes from
// the server (quizService.getCourseQuizProgress), never localStorage.
describe('getStageStatus — quiz', () => {
  const withQuiz = lesson({ _count: { tasks: 1 } });
  const passed: QuizStageProgress = { passed: true, attemptsCount: 1 };
  const attemptedNotPassed: QuizStageProgress = { passed: false, attemptsCount: 1 };
  const untouched: QuizStageProgress = { passed: false, attemptsCount: 0 };

  it('is unavailable when the lesson has no published quiz', () => {
    expect(getStageStatus(USER, lesson(), 'quiz')).toBe('unavailable');
  });

  it('is not_started when the lesson has a quiz but progress has not loaded yet', () => {
    // Undefined (not fetched yet) must never be read as "complete" — see
    // LessonPage, which mounts QuizStage lazily on first visiting the tab.
    expect(getStageStatus(USER, withQuiz, 'quiz')).toBe('not_started');
  });

  it('is not_started with real progress showing zero attempts', () => {
    expect(getStageStatus(USER, withQuiz, 'quiz', untouched)).toBe('not_started');
  });

  it('is in_progress after a failed attempt', () => {
    expect(getStageStatus(USER, withQuiz, 'quiz', attemptedNotPassed)).toBe('in_progress');
  });

  it('is completed once passed, and never un-completes on a later failed retry', () => {
    expect(getStageStatus(USER, withQuiz, 'quiz', passed)).toBe('completed');
  });
});

describe('isLessonComplete — every available stage, not just the video', () => {
  it('is NOT complete when only the video ended and the lesson has theory', () => {
    // The exact case a "watched lessons" model gets wrong.
    seedVideo('l-1', { ended: true });
    expect(isLessonComplete(USER, lesson())).toBe(false);
  });

  it('is NOT complete when only the theory is read and the lesson has a video', () => {
    markTheoryComplete(USER, 'l-1');
    expect(isLessonComplete(USER, lesson())).toBe(false);
  });

  it('is complete once both stages are done', () => {
    seedVideo('l-1', { ended: true });
    markTheoryComplete(USER, 'l-1');
    expect(isLessonComplete(USER, lesson())).toBe(true);
  });

  it('a video-only lesson completes on the video alone', () => {
    seedVideo('l-1', { ended: true });
    expect(isLessonComplete(USER, lesson({ notes: null }))).toBe(true);
  });

  it('a lesson with no completable content is never complete', () => {
    expect(isLessonComplete(USER, lesson({ videoUrl: null, notes: null }))).toBe(false);
  });

  it('is false for a signed-out visitor', () => {
    seedVideo('l-1', { ended: true });
    expect(isLessonComplete(undefined, lesson({ notes: null }))).toBe(false);
  });

  it('a lesson with a quiz is not complete until the quiz is passed too', () => {
    const withQuiz = lesson({ notes: null, _count: { tasks: 1 } });
    seedVideo('l-1', { ended: true });
    expect(isLessonComplete(USER, withQuiz)).toBe(false); // no quizProgress passed
    expect(isLessonComplete(USER, withQuiz, { passed: false, attemptsCount: 1 })).toBe(false);
    expect(isLessonComplete(USER, withQuiz, { passed: true, attemptsCount: 1 })).toBe(true);
  });
});

describe('isLessonStarted', () => {
  it('is true once any stage is touched, and false before that', () => {
    expect(isLessonStarted(USER, lesson())).toBe(false);
    seedVideo('l-1', { positionSeconds: 5 });
    expect(isLessonStarted(USER, lesson())).toBe(true);
  });
});

describe('getCourseProgress', () => {
  const lessons = [
    lesson({ id: 'l-1' }),
    lesson({ id: 'l-2' }),
    lesson({ id: 'l-3', notes: null }),
  ];

  it('counts completed lessons over every published lesson', () => {
    seedVideo('l-1', { ended: true });
    markTheoryComplete(USER, 'l-1');
    seedVideo('l-3', { ended: true }); // video-only lesson, complete

    expect(getCourseProgress(USER, lessons)).toEqual({ completed: 2, total: 3, percent: 66 });
  });

  it('does not count a lesson whose video ended but whose theory is unread', () => {
    seedVideo('l-2', { ended: true });
    expect(getCourseProgress(USER, lessons)).toEqual({ completed: 0, total: 3, percent: 0 });
  });

  it('floors the percentage rather than rounding up', () => {
    // 1/3 = 33.33 -> 33, never 34. Matches the Learning Engine's rule.
    seedVideo('l-3', { ended: true });
    expect(getCourseProgress(USER, lessons).percent).toBe(33);
  });

  it('returns a zeroed shape for a course with no lessons', () => {
    expect(getCourseProgress(USER, [])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('folds server-side quiz progress into the course-wide total', () => {
    const withQuiz = [lesson({ id: 'q-1', notes: null, _count: { tasks: 1 } })];
    seedVideo('q-1', { ended: true });

    expect(getCourseProgress(USER, withQuiz)).toEqual({ completed: 0, total: 1, percent: 0 });

    const quizProgressByLessonId = new Map([['q-1', { passed: true, attemptsCount: 1 }]]);
    expect(getCourseProgress(USER, withQuiz, quizProgressByLessonId)).toEqual({
      completed: 1,
      total: 1,
      percent: 100,
    });
  });
});

// Sprint 06C — Trap Hunter is real now. Traps are derived server-side from
// the mistakes of the most recent COMPLETED quiz attempt, so every input
// here comes from trapHunterService, never localStorage.
describe('getStageStatus — traphunter', () => {
  const withQuiz = lesson({ _count: { tasks: 1 } });

  it('is unavailable when the lesson has no published quiz — there are no mistakes to correct', () => {
    expect(getStageStatus(USER, lesson(), 'traphunter', undefined, trapProgress())).toBe(
      'unavailable',
    );
  });

  it('is blocked — never locked — before any attempt has been finished', () => {
    // 'locked' renders "Coming soon" and would tell a student that a
    // shipped feature does not exist. That is the exact bug Sprint 06B.5
    // fixed in TheoryCompletionBar, and this test stops it recurring.
    expect(getStageStatus(USER, withQuiz, 'traphunter', quizPassed, trapProgress({ hasSource: false }))).toBe(
      'blocked',
    );
  });

  it('is blocked when progress has not been fetched yet, never a guess', () => {
    expect(getStageStatus(USER, withQuiz, 'traphunter', quizPassed, undefined)).toBe('blocked');
  });

  it('is SKIPPED, not unavailable, after a perfect attempt', () => {
    // The student earned an empty stage. 'unavailable' reads as "not in this
    // lesson", which is both wrong and a deflating thing to show someone who
    // just scored 100%.
    expect(getStageStatus(USER, withQuiz, 'traphunter', quizPassed, trapProgress({ total: 0 }))).toBe(
      'skipped',
    );
  });

  it('tracks not_started -> in_progress -> completed as traps are corrected', () => {
    expect(
      getStageStatus(USER, withQuiz, 'traphunter', quizPassed, trapProgress({ total: 3, cleared: 0 })),
    ).toBe('not_started');
    expect(
      getStageStatus(USER, withQuiz, 'traphunter', quizPassed, trapProgress({ total: 3, cleared: 1 })),
    ).toBe('in_progress');
    expect(
      getStageStatus(USER, withQuiz, 'traphunter', quizPassed, trapProgress({ total: 3, cleared: 3 })),
    ).toBe('completed');
  });
});

describe('availableStages — traphunter joins only when there are traps', () => {
  const withQuiz = lesson({ _count: { tasks: 1 } });

  it.each([
    ['not fetched', undefined],
    ['no completed attempt (blocked)', trapProgress({ hasSource: false })],
    ['a perfect attempt (skipped)', trapProgress({ total: 0 })],
  ])('is excluded when there is %s', (_label, progress) => {
    expect(availableStages(withQuiz, progress as TrapHunterStageProgress | undefined)).toEqual([
      'video',
      'theory',
      'quiz',
    ]);
  });

  it('is included once an attempt actually produced traps', () => {
    expect(availableStages(withQuiz, trapProgress({ total: 2 }))).toEqual([
      'video',
      'theory',
      'quiz',
      'traphunter',
    ]);
  });

  it('is excluded on a lesson with no quiz, whatever is passed in', () => {
    expect(availableStages(lesson(), trapProgress({ total: 5 }))).not.toContain('traphunter');
  });
});

describe('isLessonComplete — Trap Hunter counts, through availableStages', () => {
  const withQuiz = lesson({ notes: null, _count: { tasks: 1 } });

  beforeEach(() => seedVideo('l-1', { ended: true }));

  it('is NOT complete while traps remain, even with the quiz passed', () => {
    expect(
      isLessonComplete(USER, withQuiz, quizPassed, trapProgress({ total: 2, cleared: 1 })),
    ).toBe(false);
  });

  it('completes once every trap is corrected', () => {
    expect(
      isLessonComplete(USER, withQuiz, quizPassed, trapProgress({ total: 2, cleared: 2 })),
    ).toBe(true);
  });

  it('completes on the quiz alone after a perfect attempt — a skipped stage is owed nothing', () => {
    expect(isLessonComplete(USER, withQuiz, quizPassed, trapProgress({ total: 0 }))).toBe(true);
  });

  it('behaves EXACTLY as it did before Sprint 06C when no trap progress is passed', () => {
    // The compatibility guarantee: a caller that has not been updated to
    // fetch trap progress reports a stale number, never a wrong one.
    expect(isLessonComplete(USER, withQuiz, quizPassed)).toBe(true);
  });
});

// INVARIANT A. The single most important test in this file for what comes
// next: lesson completion must stay driven by availableStages(), never by a
// hardcoded `theory && quiz && traphunter` conjunction. Trap Hunter is one
// entry in a list, not the final stage.
//
// Sprint 06D adds Advanced Practice to availableStages() and completion has
// to widen on its own. This test proves it will, WITHOUT importing or
// touching a line of Trap Hunter's logic: it simulates the arrival of one
// further available stage and asserts the lesson stops being complete.
describe('INVARIANT A — completion is stage-driven and dynamic', () => {
  it('a lesson with every current stage done is incomplete the moment another stage becomes available', () => {
    const withQuiz = lesson({ _count: { tasks: 1 } });
    seedVideo('l-1', { ended: true });
    markTheoryComplete(USER, 'l-1');

    // Everything Sprint 06C knows about is finished.
    const done = trapProgress({ total: 2, cleared: 2 });
    expect(isLessonComplete(USER, withQuiz, quizPassed, done)).toBe(true);
    expect(availableStages(withQuiz, done)).toEqual([
      'video',
      'theory',
      'quiz',
      'traphunter',
    ]);

    // Now stand in for Sprint 06D: one more stage becomes available and is
    // not finished. isLessonComplete must fall to false purely because
    // `stages.every(...)` has one more entry to satisfy.
    const stages = availableStages(withQuiz, done);
    const withFutureStage = [...stages, 'practice' as const];
    const allComplete = withFutureStage.every(
      (stage) => getStageStatus(USER, withQuiz, stage, quizPassed, done) === 'completed',
    );
    expect(allComplete).toBe(false);

    // ...and the reason is the new stage, not anything Trap Hunter did.
    expect(
      stages.every(
        (stage) => getStageStatus(USER, withQuiz, stage, quizPassed, done) === 'completed',
      ),
    ).toBe(true);
  });
});

describe('clearLessonStages', () => {
  it('removes only that user’s stage records', () => {
    markTheoryComplete(USER, 'l-1');
    markTheoryComplete('user-2', 'l-1');
    localStorage.setItem('unrelated', 'keep-me');

    clearLessonStages(USER);

    expect(localStorage.getItem(`lessonStages:${USER}:l-1`)).toBeNull();
    expect(localStorage.getItem('lessonStages:user-2:l-1')).not.toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep-me');
  });
});
