import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  availableStages,
  clearLessonStages,
  getCourseProgress,
  getStageStatus,
  isLessonComplete,
  isLessonStarted,
  markTheoryComplete,
} from './lessonProgress';
import { VideoProgressEntry } from './videoProgress';

// Sprint 06 — these tests pin down the decision the whole sprint rests on:
// progress counts COMPLETED LESSONS, not watched videos. A Lesson is
// becoming Video -> Theory -> Mini Check -> Practice, so if the unit were
// "video watched", every stage added later would break the progress UI.
// `isLessonComplete` is the seam a real backend will replace, and the
// assertions below are what keep it honest in the meantime.

const USER = 'user-1';

const lesson = (over: Partial<{ id: string; videoUrl: string | null; notes: string | null }> = {}) => ({
  id: 'l-1',
  videoUrl: 'https://youtu.be/abc',
  notes: '## Rule one\nBody text',
  ...over,
});

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

  it('never includes a stage that has no backend', () => {
    // Quiz / Trap Hunter / Advanced practice need LessonTask/Question, which
    // has no module. Requiring them would make every lesson permanently
    // incomplete.
    expect(availableStages(lesson())).not.toContain('quiz');
    expect(availableStages(lesson())).not.toContain('traphunter');
    expect(availableStages(lesson())).not.toContain('practice');
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
  it.each(['quiz', 'traphunter', 'practice'] as const)('%s is locked', (stage) => {
    expect(getStageStatus(USER, lesson(), stage)).toBe('locked');
  });

  it('stays locked even if storage is hand-edited to claim completion', () => {
    // The status is a constant, never read from storage, so no stale or
    // tampered localStorage can make an unbuilt stage look finished.
    localStorage.setItem(
      `lessonStages:${USER}:l-1`,
      JSON.stringify({ theoryCompletedAt: 'x', quizCompletedAt: 'x', practiceCompletedAt: 'x' }),
    );
    expect(getStageStatus(USER, lesson(), 'quiz')).toBe('locked');
    expect(getStageStatus(USER, lesson(), 'traphunter')).toBe('locked');
    expect(getStageStatus(USER, lesson(), 'practice')).toBe('locked');
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
