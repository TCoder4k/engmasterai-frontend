import { Lesson } from '../types';
import { parseGrammarNotes } from '../components/lesson/grammar/parseGrammarNotes';
import { getVideoProgress } from './videoProgress';

// Sprint 06 — the single source of truth for "how far through a lesson is
// this student", and the seam a real backend will eventually replace.
//
// WHY COMPLETION AND NOT "WATCHED":
// A Lesson is becoming Video -> Theory -> Mini Check -> Practice. If the UI
// counted *videos watched*, every stage added later would force the roadmap
// card, the course hero and the lesson list to be rewritten. So the unit
// exposed to the UI is a COMPLETED LESSON — every stage that lesson actually
// has, finished — and `isLessonComplete` is the only place that definition
// lives. When Mini Check and Practice ship (they need LessonTask/Question,
// which has models but no module and no API), this file changes and the
// components reading it do not.
//
// Storage is per-user and DEVICE-LOCAL, like recentActivity.ts and
// videoProgress.ts. Callers pass userId explicitly rather than this module
// importing authService, keeping the storage helper decoupled in both
// directions. Every surface showing a number derived from here must say it
// is device-local — it is real data about this student, but it is not
// server-backed and does not follow them to another browser.

export type LessonStageId = 'video' | 'theory' | 'quiz' | 'traphunter' | 'practice';

export type StageStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  // No backend exists for this stage at all — it is not merely unstarted.
  | 'locked'
  // The stage exists in principle but this particular lesson has no content
  // for it (e.g. no videoUrl). Never counted toward completion.
  | 'unavailable';

// Ordered as the student meets them.
export const LESSON_STAGE_IDS: LessonStageId[] = ['video', 'theory', 'quiz', 'traphunter', 'practice'];

// Stages with no module behind them. Their status is a CONSTANT, never read
// from storage, so no amount of stale or hand-edited localStorage can make
// them look finished.
const LOCKED_STAGES: LessonStageId[] = ['quiz', 'traphunter', 'practice'];

interface LessonStageRecord {
  theoryCompletedAt?: string;
}

const keyFor = (userId: string, lessonId: string) => `lessonStages:${userId}:${lessonId}`;

const readRecord = (userId: string, lessonId: string): LessonStageRecord => {
  try {
    const raw = localStorage.getItem(keyFor(userId, lessonId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as LessonStageRecord) : {};
  } catch {
    return {};
  }
};

const writeRecord = (userId: string, lessonId: string, record: LessonStageRecord): void => {
  try {
    localStorage.setItem(keyFor(userId, lessonId), JSON.stringify(record));
  } catch {
    // Best-effort: a full or unavailable localStorage must never break the
    // lesson itself.
  }
};

// --- What a lesson actually offers -----------------------------------------

export const lessonHasVideo = (lesson: Pick<Lesson, 'videoUrl'>): boolean =>
  Boolean(lesson.videoUrl && lesson.videoUrl.trim());

export const lessonHasTheory = (lesson: Pick<Lesson, 'notes'>): boolean => {
  const parsed = parseGrammarNotes(lesson.notes);
  return parsed.sections.length > 0 || Boolean(parsed.fallbackText);
};

// The stages this lesson can actually be completed through today. Locked
// stages are deliberately NOT included: requiring a stage that cannot be
// started would make every lesson permanently incomplete.
export const availableStages = (lesson: Pick<Lesson, 'videoUrl' | 'notes'>): LessonStageId[] => {
  const stages: LessonStageId[] = [];
  if (lessonHasVideo(lesson)) stages.push('video');
  if (lessonHasTheory(lesson)) stages.push('theory');
  return stages;
};

// --- Per-stage status -------------------------------------------------------

export const getStageStatus = (
  userId: string | undefined,
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes'>,
  stage: LessonStageId,
): StageStatus => {
  if (LOCKED_STAGES.includes(stage)) return 'locked';
  if (!userId) return 'not_started';

  if (stage === 'video') {
    if (!lessonHasVideo(lesson)) return 'unavailable';
    // Derived from the EXISTING video-resume store — no duplicate state to
    // drift out of sync with the player.
    const progress = getVideoProgress(userId, lesson.id);
    if (!progress) return 'not_started';
    if (progress.ended) return 'completed';
    return progress.positionSeconds > 0 ? 'in_progress' : 'not_started';
  }

  if (stage === 'theory') {
    if (!lessonHasTheory(lesson)) return 'unavailable';
    return readRecord(userId, lesson.id).theoryCompletedAt ? 'completed' : 'not_started';
  }

  return 'not_started';
};

export const markTheoryComplete = (userId: string, lessonId: string): void => {
  writeRecord(userId, lessonId, {
    ...readRecord(userId, lessonId),
    theoryCompletedAt: new Date().toISOString(),
  });
};

// --- Lesson and course completion ------------------------------------------

// THE seam. A lesson is complete when EVERY stage it offers is complete —
// not when its video ended. A lesson with notes stays incomplete until the
// theory is marked read, which is exactly the case a "watched" model gets
// wrong and the one the tests pin down.
export const isLessonComplete = (
  userId: string | undefined,
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes'>,
): boolean => {
  if (!userId) return false;
  const stages = availableStages(lesson);
  if (stages.length === 0) return false;
  return stages.every((stage) => getStageStatus(userId, lesson, stage) === 'completed');
};

// A lesson is "in progress" once any stage has been touched but not all are
// done — drives the neutral middle badge in lesson lists.
export const isLessonStarted = (
  userId: string | undefined,
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes'>,
): boolean => {
  if (!userId) return false;
  return availableStages(lesson).some((stage) => {
    const status = getStageStatus(userId, lesson, stage);
    return status === 'in_progress' || status === 'completed';
  });
};

export interface CourseProgress {
  completed: number;
  total: number;
  percent: number;
}

// Denominator is every published lesson handed in — safe because the backend
// refuses to publish a lesson with neither videoUrl nor audioUrl, so a
// published lesson always has completable content and 100% stays reachable.
export const getCourseProgress = (
  userId: string | undefined,
  lessons: Pick<Lesson, 'id' | 'videoUrl' | 'notes'>[],
): CourseProgress => {
  const total = lessons.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };
  const completed = lessons.filter((lesson) => isLessonComplete(userId, lesson)).length;
  // floor, matching the Learning Engine's percentages (ADR 007 §5) — a
  // single finished lesson out of 20 must not round up to look like more.
  return { completed, total, percent: Math.floor((completed / total) * 100) };
};

// Called on logout so a shared/school device never shows one student's stage
// progress under another account — the same rule videoProgress.ts and
// recentActivity.ts already follow.
export const clearLessonStages = (userId: string): void => {
  const prefix = `lessonStages:${userId}:`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) localStorage.removeItem(key);
  }
};
