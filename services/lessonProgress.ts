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
// Sprint 06B: Quiz is exactly that moment for the 'quiz' stage. It leaves
// LOCKED_STAGES and gains a real, server-backed status — see
// getStageStatus's `quizProgress` parameter below. traphunter/practice still
// have no module at all and stay constant-locked, preserving the invariant
// that a stage with nothing behind it can never look finished.
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

// Stages with no module behind them at all. Their status is a CONSTANT,
// never read from storage or any server response, so no amount of stale or
// hand-edited local state can make them look finished. 'quiz' left this set
// in Sprint 06B — it now has a real backend (see getStageStatus below).
const LOCKED_STAGES: LessonStageId[] = ['traphunter', 'practice'];

// The subset of a course-quiz-progress row getStageStatus/isLessonComplete
// actually need — matches quizService.CourseQuizProgressRow without this
// file importing the service module (keeps the dependency direction
// service -> progress, not the other way).
export interface QuizStageProgress {
  passed: boolean;
  attemptsCount: number;
}

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

// Sprint 06B — real signal from the backend (LessonService's USER_SELECT
// counts published QUIZ tasks only), not a guess. A lesson with no quiz
// authored/published never gains a 'quiz' stage, exactly like a lesson with
// no video never gains a 'video' stage.
export const lessonHasQuiz = (lesson: Pick<Lesson, '_count'>): boolean =>
  (lesson._count?.tasks ?? 0) > 0;

// The stages this lesson can actually be completed through today. Locked
// stages are deliberately NOT included: requiring a stage that cannot be
// started would make every lesson permanently incomplete.
export const availableStages = (
  lesson: Pick<Lesson, 'videoUrl' | 'notes' | '_count'>,
): LessonStageId[] => {
  const stages: LessonStageId[] = [];
  if (lessonHasVideo(lesson)) stages.push('video');
  if (lessonHasTheory(lesson)) stages.push('theory');
  if (lessonHasQuiz(lesson)) stages.push('quiz');
  return stages;
};

// --- Per-stage status -------------------------------------------------------

// `quizProgress` is OPTIONAL and comes from the server (services/quizService's
// getCourseQuizProgress) — this module has no business calling the network
// itself. Omitted, a lesson with a real quiz is reported 'unavailable' for
// that stage rather than guessed at: callers that haven't been updated to
// fetch quiz progress correctly stop claiming such a lesson is complete,
// instead of fabricating a status. Callers that DO fetch it (LessonPage,
// CourseDetailPage) pass it through and get real 'completed'/'in_progress'.
export const getStageStatus = (
  userId: string | undefined,
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes' | '_count'>,
  stage: LessonStageId,
  quizProgress?: QuizStageProgress,
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

  if (stage === 'quiz') {
    if (!lessonHasQuiz(lesson)) return 'unavailable';
    // The lesson DOES have a quiz here — quizProgress being undefined means
    // "not fetched yet", not "doesn't exist", so 'not_started' (never
    // fabricating 'completed') is the honest default until real data
    // arrives, exactly like a freshly-registered student's video/theory
    // stages before they've touched either.
    if (!quizProgress) return 'not_started';
    if (quizProgress.passed) return 'completed';
    return quizProgress.attemptsCount > 0 ? 'in_progress' : 'not_started';
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
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes' | '_count'>,
  quizProgress?: QuizStageProgress,
): boolean => {
  if (!userId) return false;
  const stages = availableStages(lesson);
  if (stages.length === 0) return false;
  return stages.every((stage) => getStageStatus(userId, lesson, stage, quizProgress) === 'completed');
};

// A lesson is "in progress" once any stage has been touched but not all are
// done — drives the neutral middle badge in lesson lists.
export const isLessonStarted = (
  userId: string | undefined,
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes' | '_count'>,
  quizProgress?: QuizStageProgress,
): boolean => {
  if (!userId) return false;
  return availableStages(lesson).some((stage) => {
    const status = getStageStatus(userId, lesson, stage, quizProgress);
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
  lessons: Pick<Lesson, 'id' | 'videoUrl' | 'notes' | '_count'>[],
  // Sprint 06B — keyed by lessonId, from quizService.getCourseQuizProgress.
  // Omitted, every lesson with a real quiz is treated as not-yet-passed
  // (see getStageStatus) rather than fabricated as complete.
  quizProgressByLessonId?: Map<string, QuizStageProgress>,
): CourseProgress => {
  const total = lessons.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };
  const completed = lessons.filter((lesson) =>
    isLessonComplete(userId, lesson, quizProgressByLessonId?.get(lesson.id)),
  ).length;
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
