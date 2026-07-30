import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  availableStages,
  getCourseProgress,
  getStageStatus,
  isLessonComplete,
  isLessonStarted,
  purgeLegacyLocalProgress,
  LessonProgressSnapshot,
  PracticeStageProgress,
  StepProgress,
  TrapHunterStageProgress,
} from './lessonProgress';
import { LessonTaskType } from '../types';

// Sprint 06 — these tests pin down the decision the whole module rests on:
// progress counts COMPLETED LESSONS, not watched videos. A Lesson is
// Video -> Theory -> Quiz -> Trap Hunter -> Advanced Practice, so if the unit
// were "video watched", every stage added later would break the progress UI.
//
// Sprint 07 — video and theory moved from localStorage to the server, so this
// module now derives EVERYTHING from facts it is handed and owns no state at
// all. The dedicated block at the bottom pins that: writing the old keys by
// hand must no longer change a single status.

const USER = 'user-1';

const lesson = (
  over: Partial<{
    id: string;
    videoUrl: string | null;
    notes: string | null;
    publishedTaskTypes: LessonTaskType[];
  }> = {},
) => ({
  id: 'l-1',
  videoUrl: 'https://youtu.be/abc',
  notes: '## Rule one\nBody text',
  publishedTaskTypes: [],
  ...over,
});

const step = (over: Partial<StepProgress> = {}): StepProgress => ({
  startedAt: '2026-07-30T00:00:00.000Z',
  completedAt: null,
  ...over,
});

const doneStep = step({ completedAt: '2026-07-30T00:05:00.000Z' });

// `hasSource: true` is the default because it is the interesting case — a
// completed quiz attempt exists, and what varies is how many mistakes it made.
const trapProgress = (
  over: Partial<TrapHunterStageProgress> = {},
): TrapHunterStageProgress => ({
  hasSource: true,
  total: 2,
  cleared: 0,
  ...over,
});

const quizPassed = { passed: true, attemptsCount: 1 };
const practiceDone: PracticeStageProgress = { passed: true, attemptsCount: 1 };

// Every stage of a fully-finished lesson, so individual tests can knock one
// piece out rather than rebuilding the whole object.
const allDone = (over: Partial<LessonProgressSnapshot> = {}): LessonProgressSnapshot => ({
  steps: { video: doneStep, theory: doneStep },
  quiz: quizPassed,
  trapHunter: trapProgress({ total: 2, cleared: 2 }),
  practice: practiceDone,
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('availableStages', () => {
  it('lists only the stages the lesson actually has content for', () => {
    expect(availableStages(lesson())).toEqual(['video', 'theory']);
  });

  it('omits video when the lesson has none', () => {
    expect(availableStages(lesson({ videoUrl: null }))).toEqual(['theory']);
  });

  it('omits theory when the notes are blank', () => {
    expect(availableStages(lesson({ notes: '   ' }))).toEqual(['video']);
  });

  it('adds quiz only when a published quiz task exists', () => {
    expect(availableStages(lesson({ publishedTaskTypes: ['QUIZ'] }))).toContain('quiz');
    expect(availableStages(lesson())).not.toContain('quiz');
  });

  it('adds practice only when a published practice task exists', () => {
    expect(availableStages(lesson({ publishedTaskTypes: ['PRACTICE'] }))).toContain('practice');
    expect(availableStages(lesson())).not.toContain('practice');
  });

  it('adds traphunter only once an attempt has actually produced traps', () => {
    const withQuiz = lesson({ publishedTaskTypes: ['QUIZ'] });
    expect(availableStages(withQuiz)).not.toContain('traphunter');
    expect(availableStages(withQuiz, trapProgress({ total: 0 }))).not.toContain('traphunter');
    expect(availableStages(withQuiz, trapProgress({ total: 2 }))).toContain('traphunter');
  });
});

describe('getStageStatus — video and theory come from the server', () => {
  it('reports not_started when the server has no row', () => {
    expect(getStageStatus(USER, lesson(), 'video', { steps: { video: null, theory: null } })).toBe(
      'not_started',
    );
  });

  it('reports not_started when progress has not been fetched at all', () => {
    expect(getStageStatus(USER, lesson(), 'video')).toBe('not_started');
  });

  it('reports in_progress once a step has been started', () => {
    expect(
      getStageStatus(USER, lesson(), 'video', { steps: { video: step(), theory: null } }),
    ).toBe('in_progress');
  });

  it('reports completed once the server has stamped completedAt', () => {
    expect(
      getStageStatus(USER, lesson(), 'video', { steps: { video: doneStep, theory: null } }),
    ).toBe('completed');
  });

  it('reports unavailable when the lesson has no video', () => {
    expect(getStageStatus(USER, lesson({ videoUrl: null }), 'video', allDone())).toBe(
      'unavailable',
    );
  });

  it('applies the same three states to theory', () => {
    expect(
      getStageStatus(USER, lesson(), 'theory', { steps: { video: null, theory: null } }),
    ).toBe('not_started');
    expect(
      getStageStatus(USER, lesson(), 'theory', { steps: { video: null, theory: step() } }),
    ).toBe('in_progress');
    expect(
      getStageStatus(USER, lesson(), 'theory', { steps: { video: null, theory: doneStep } }),
    ).toBe('completed');
    expect(getStageStatus(USER, lesson({ notes: null }), 'theory', allDone())).toBe('unavailable');
  });
});

describe('getStageStatus — quiz', () => {
  const withQuiz = lesson({ publishedTaskTypes: ['QUIZ'] });

  it('is unavailable on a lesson with no published quiz', () => {
    expect(getStageStatus(USER, lesson(), 'quiz', allDone())).toBe('unavailable');
  });

  it('is not_started when progress has not been fetched', () => {
    expect(getStageStatus(USER, withQuiz, 'quiz', {})).toBe('not_started');
  });

  it('is in_progress after a failed attempt', () => {
    expect(
      getStageStatus(USER, withQuiz, 'quiz', { quiz: { passed: false, attemptsCount: 1 } }),
    ).toBe('in_progress');
  });

  it('is completed once passed, and never un-completes', () => {
    expect(getStageStatus(USER, withQuiz, 'quiz', { quiz: quizPassed })).toBe('completed');
    // A later worse attempt raises attemptsCount but keeps passed true.
    expect(
      getStageStatus(USER, withQuiz, 'quiz', { quiz: { passed: true, attemptsCount: 4 } }),
    ).toBe('completed');
  });
});

describe('getStageStatus — traphunter', () => {
  const withQuiz = lesson({ publishedTaskTypes: ['QUIZ'] });

  it('is unavailable without a quiz to derive traps from', () => {
    expect(getStageStatus(USER, lesson(), 'traphunter', allDone())).toBe('unavailable');
  });

  it('is blocked until a completed attempt exists', () => {
    expect(getStageStatus(USER, withQuiz, 'traphunter', {})).toBe('blocked');
    expect(
      getStageStatus(USER, withQuiz, 'traphunter', { trapHunter: trapProgress({ hasSource: false }) }),
    ).toBe('blocked');
  });

  it('is skipped after a perfect attempt — earned, not missing', () => {
    expect(
      getStageStatus(USER, withQuiz, 'traphunter', { trapHunter: trapProgress({ total: 0 }) }),
    ).toBe('skipped');
  });

  it('moves not_started -> in_progress -> completed as traps are cleared', () => {
    const at = (cleared: number) =>
      getStageStatus(USER, withQuiz, 'traphunter', {
        trapHunter: trapProgress({ total: 2, cleared }),
      });
    expect(at(0)).toBe('not_started');
    expect(at(1)).toBe('in_progress');
    expect(at(2)).toBe('completed');
  });
});

describe('getStageStatus — practice', () => {
  const withPractice = lesson({ publishedTaskTypes: ['QUIZ', 'PRACTICE'] });

  it('is unavailable without a published practice task', () => {
    expect(getStageStatus(USER, lesson(), 'practice', allDone())).toBe('unavailable');
  });

  it('is blocked when the SERVER says the prerequisites are unmet', () => {
    // Sprint 07 — this comes from the server now. The client used to derive it
    // from quiz and trap progress, in a hand-maintained mirror of the
    // backend's practice-prerequisites.ts; two implementations of one rule
    // drift, so the client copy was deleted.
    expect(
      getStageStatus(USER, withPractice, 'practice', {
        practice: {
          passed: false,
          attemptsCount: 0,
          availability: { state: 'blocked', reason: 'quiz_not_passed' },
        },
      }),
    ).toBe('blocked');
  });

  it('distinguishes the two blocked reasons without inventing either', () => {
    const blockedBy = (reason: 'quiz_not_passed' | 'traps_outstanding') =>
      getStageStatus(USER, withPractice, 'practice', {
        practice: {
          passed: false,
          attemptsCount: 0,
          availability: { state: 'blocked', reason },
        },
      });
    expect(blockedBy('quiz_not_passed')).toBe('blocked');
    expect(blockedBy('traps_outstanding')).toBe('blocked');
  });

  it('is never "locked" — that would claim a shipped feature does not exist', () => {
    expect(getStageStatus(USER, withPractice, 'practice', {})).not.toBe('locked');
  });

  it('opens once the server reports it available', () => {
    expect(
      getStageStatus(USER, withPractice, 'practice', {
        practice: { passed: false, attemptsCount: 0, availability: { state: 'available' } },
      }),
    ).toBe('not_started');
  });

  it('moves through in_progress to completed', () => {
    expect(
      getStageStatus(USER, withPractice, 'practice', {
        practice: { passed: false, attemptsCount: 2, availability: { state: 'available' } },
      }),
    ).toBe('in_progress');
    expect(
      getStageStatus(USER, withPractice, 'practice', { practice: practiceDone }),
    ).toBe('completed');
  });

  it('falls back to progress alone when availability is absent (course aggregate)', () => {
    // The course payload deliberately omits availability: that page renders a
    // percentage, and 'blocked' and 'not_started' are the same thing for it.
    expect(
      getStageStatus(USER, withPractice, 'practice', { practice: practiceDone }),
    ).toBe('completed');
  });
});

describe('isLessonComplete', () => {
  it('needs every stage the lesson offers, not just the video', () => {
    expect(
      isLessonComplete(USER, lesson(), { steps: { video: doneStep, theory: null } }),
    ).toBe(false);
    expect(
      isLessonComplete(USER, lesson(), { steps: { video: doneStep, theory: doneStep } }),
    ).toBe(true);
  });

  it('completes a video-only lesson on the video alone', () => {
    expect(
      isLessonComplete(USER, lesson({ notes: null }), {
        steps: { video: doneStep, theory: null },
      }),
    ).toBe(true);
  });

  it('is never complete for a lesson with no completable content', () => {
    expect(isLessonComplete(USER, lesson({ videoUrl: null, notes: null }), allDone())).toBe(false);
  });

  it('is false when signed out', () => {
    expect(isLessonComplete(undefined, lesson(), allDone())).toBe(false);
  });

  it('requires the quiz to be PASSED, not merely attempted', () => {
    const withQuiz = lesson({ publishedTaskTypes: ['QUIZ'] });
    const base = { steps: { video: doneStep, theory: doneStep } };
    expect(
      isLessonComplete(USER, withQuiz, { ...base, quiz: { passed: false, attemptsCount: 3 } }),
    ).toBe(false);
    expect(isLessonComplete(USER, withQuiz, { ...base, quiz: quizPassed })).toBe(true);
  });

  it('stays incomplete while traps remain, even with the quiz passed', () => {
    const withQuiz = lesson({ notes: null, publishedTaskTypes: ['QUIZ'] });
    expect(
      isLessonComplete(USER, withQuiz, {
        steps: { video: doneStep, theory: null },
        quiz: quizPassed,
        trapHunter: trapProgress({ total: 2, cleared: 1 }),
      }),
    ).toBe(false);
  });
});

describe('isLessonStarted', () => {
  it('is true once any stage has been touched', () => {
    expect(
      isLessonStarted(USER, lesson(), { steps: { video: step(), theory: null } }),
    ).toBe(true);
  });

  it('is false when nothing has been touched', () => {
    expect(
      isLessonStarted(USER, lesson(), { steps: { video: null, theory: null } }),
    ).toBe(false);
  });
});

describe('getCourseProgress', () => {
  const lessons = [lesson({ id: 'a' }), lesson({ id: 'b' }), lesson({ id: 'c' })];

  it('counts completed lessons and FLOORS the percentage', () => {
    const map = new Map<string, LessonProgressSnapshot>([
      ['a', { steps: { video: doneStep, theory: doneStep } }],
    ]);
    // 1/3 must read 33, never 34 — a single finished lesson must not round up.
    expect(getCourseProgress(USER, lessons, map)).toEqual({
      completed: 1,
      total: 3,
      percent: 33,
    });
  });

  it('returns a zeroed shape for a course with no lessons', () => {
    expect(getCourseProgress(USER, [], new Map())).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
    });
  });

  it('reports zero rather than guessing when progress was never fetched', () => {
    expect(getCourseProgress(USER, lessons).completed).toBe(0);
  });
});

// INVARIANT A — lesson completion is stage-driven and dynamic.
//
// Sprint 06D replaced the single test that used to live here, which stood in
// for "a hypothetical future stage" by using 'practice' itself and became a
// tautology the moment practice shipped. Three tests replace it: the first is
// the one that actually kills the forbidden rewrite, the others prove the fold
// widened and keeps delegating.
describe('INVARIANT A — completion is stage-driven and dynamic', () => {
  it('completes a lesson that SKIPS optional stages — a hardcoded conjunction cannot', () => {
    // The discriminating case. A lesson with no notes and no video offers
    // neither 'theory' nor 'video', so the forbidden
    //     theoryCompleted && quizPassed && trapsCleared && practicePassed
    // is FALSE here (theory was never completed — there was no theory), while
    // `availableStages().every(...)` is TRUE. Any rewrite to a fixed
    // conjunction fails this test, which is the whole reason it exists.
    const sparse = lesson({
      videoUrl: null,
      notes: null,
      publishedTaskTypes: ['QUIZ', 'PRACTICE'],
    });
    const progress: LessonProgressSnapshot = {
      steps: { video: null, theory: null },
      quiz: quizPassed,
      trapHunter: trapProgress({ total: 0 }),
      practice: practiceDone,
    };

    expect(availableStages(sparse, progress.trapHunter)).toEqual(['quiz', 'practice']);
    expect(isLessonComplete(USER, sparse, progress)).toBe(true);
  });

  it('widened on its own when Advanced Practice arrived', () => {
    const full = lesson({ publishedTaskTypes: ['QUIZ', 'PRACTICE'] });
    const done = trapProgress({ total: 2, cleared: 2 });
    const withoutPractice: LessonProgressSnapshot = {
      steps: { video: doneStep, theory: doneStep },
      quiz: quizPassed,
      trapHunter: done,
    };

    expect(availableStages(full, done)).toEqual([
      'video',
      'theory',
      'quiz',
      'traphunter',
      'practice',
    ]);
    expect(isLessonComplete(USER, full, withoutPractice)).toBe(false);
    expect(
      isLessonComplete(USER, full, { ...withoutPractice, practice: practiceDone }),
    ).toBe(true);
  });

  it('stays equal to availableStages().every(completed) across a fixture matrix', () => {
    // The mechanism check: isLessonComplete must keep DELEGATING, whatever the
    // stage list happens to be. It fails the moment the body stops being a
    // fold over availableStages() — including for a stage list this test does
    // not know about yet.
    const steps = { video: doneStep, theory: doneStep };
    const cases: { l: ReturnType<typeof lesson>; p: LessonProgressSnapshot }[] = [
      { l: lesson(), p: { steps } },
      {
        l: lesson({ publishedTaskTypes: ['QUIZ'] }),
        p: { steps, quiz: quizPassed, trapHunter: trapProgress({ total: 0 }) },
      },
      {
        l: lesson({ publishedTaskTypes: ['QUIZ', 'PRACTICE'] }),
        p: { steps, quiz: quizPassed, trapHunter: trapProgress({ total: 2, cleared: 1 }) },
      },
      {
        l: lesson({ publishedTaskTypes: ['PRACTICE'] }),
        p: { steps, practice: practiceDone },
      },
      {
        l: lesson({ videoUrl: null, notes: null, publishedTaskTypes: ['PRACTICE'] }),
        p: { steps: { video: null, theory: null }, practice: practiceDone },
      },
    ];

    cases.forEach(({ l, p }) => {
      const stages = availableStages(l, p.trapHunter);
      const expected =
        stages.length > 0 &&
        stages.every((stage) => getStageStatus(USER, l, stage, p) === 'completed');
      expect(isLessonComplete(USER, l, p)).toBe(expected);
    });
  });
});

// SPRINT 07 — THE GUARD THAT HAD NO COUNTERPART BEFORE THIS SPRINT.
//
// Until now, `video` and `theory` were read straight out of localStorage, so
// hand-writing two keys in DevTools marked a lesson complete and raised the
// course percentage with no server involvement whatsoever. The practice stage
// already carried an equivalent assertion; video and theory could not, because
// localStorage WAS their authority.
describe('local storage has no authority over any stage', () => {
  const seedLegacyKeys = () => {
    localStorage.setItem(
      `videoProgress:${USER}:l-1`,
      JSON.stringify({ positionSeconds: 600, durationSeconds: 600, ended: true }),
    );
    localStorage.setItem(
      `lessonStages:${USER}:l-1`,
      JSON.stringify({ theoryCompletedAt: '2026-07-30T00:00:00.000Z' }),
    );
  };

  it('does not let a forged video key complete the video stage', () => {
    seedLegacyKeys();
    expect(
      getStageStatus(USER, lesson(), 'video', { steps: { video: null, theory: null } }),
    ).toBe('not_started');
  });

  it('does not let a forged theory key complete the theory stage', () => {
    seedLegacyKeys();
    expect(
      getStageStatus(USER, lesson(), 'theory', { steps: { video: null, theory: null } }),
    ).toBe('not_started');
  });

  it('does not let forged keys complete a lesson or move a course percentage', () => {
    seedLegacyKeys();
    const empty: LessonProgressSnapshot = { steps: { video: null, theory: null } };
    expect(isLessonComplete(USER, lesson(), empty)).toBe(false);
    expect(
      getCourseProgress(USER, [lesson()], new Map([['l-1', empty]])).percent,
    ).toBe(0);
  });
});

describe('purgeLegacyLocalProgress', () => {
  it('removes every legacy progress key, for every user, and nothing else', () => {
    localStorage.setItem(`videoProgress:${USER}:l-1`, '{}');
    localStorage.setItem('lessonStages:user-2:l-9', '{}');
    localStorage.setItem('accessToken', 'keep-me');
    localStorage.setItem('unrelated', 'keep-me');

    purgeLegacyLocalProgress();

    expect(localStorage.getItem(`videoProgress:${USER}:l-1`)).toBeNull();
    expect(localStorage.getItem('lessonStages:user-2:l-9')).toBeNull();
    // Auth must survive: a boot-time purge that logged everyone out would be a
    // far worse bug than the one it is cleaning up after.
    expect(localStorage.getItem('accessToken')).toBe('keep-me');
    expect(localStorage.getItem('unrelated')).toBe('keep-me');
  });
});
