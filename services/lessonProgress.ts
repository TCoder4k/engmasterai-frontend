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
// Sprint 06C: Trap Hunter is that moment for 'traphunter'. 'practice'
// (Advanced Practice) is deliberately UNCHANGED — still constant-locked,
// still no module, reserved for Sprint 06D.
//
// INVARIANT A — LESSON COMPLETION IS STAGE-DRIVEN AND DYNAMIC.
// isLessonComplete asks `availableStages(lesson).every(completed)` and must
// keep asking exactly that. It must never be rewritten as a hardcoded
// conjunction such as:
//
//     theoryCompleted && quizPassed && trapHunterCompleted   // FORBIDDEN
//
// Trap Hunter is not the final stage — it is one more entry in a list. When
// Advanced Practice gains a backend in Sprint 06D it joins availableStages()
// and completion widens on its own, with ZERO changes to Trap Hunter's
// completion logic. lessonProgress.test.ts pins this directly.
//
// Storage is per-user and DEVICE-LOCAL, like recentActivity.ts and
// videoProgress.ts. Callers pass userId explicitly rather than this module
// importing authService, keeping the storage helper decoupled in both
// directions. Every surface showing a number derived from here must say it
// is device-local — it is real data about this student, but it is not
// server-backed and does not follow them to another browser.

export type LessonStageId = 'video' | 'theory' | 'quiz' | 'traphunter' | 'practice';

// Sprint 06C added 'blocked' and 'skipped'. Before that, one status was
// doing three different jobs, and two of them were misleading.
export type StageStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  // No backend exists for this stage at all — it is not merely unstarted.
  // Renders "Coming soon". As of Sprint 06C this is 'practice' only.
  | 'locked'
  // A REAL, live stage whose prerequisite is not met yet — Trap Hunter
  // before the quiz has been finished. Deliberately not 'locked': that
  // renders "Coming soon" and would tell a student a shipped feature does
  // not exist, which is exactly the bug Sprint 06B.5 fixed in
  // TheoryCompletionBar.
  | 'blocked'
  // The stage exists in principle but this particular lesson has no content
  // for it (e.g. no videoUrl, no published quiz). Never counted toward
  // completion.
  | 'unavailable'
  // The stage ran its course and had nothing to do: a quiz answered with no
  // mistakes leaves Trap Hunter with no traps. Distinct from 'unavailable'
  // ("not in this lesson"), which reads as the feature not applying and is
  // a deflating thing to show someone who just scored 100%. Never counted
  // toward completion either — there is nothing to complete.
  | 'skipped';

// Ordered as the student meets them.
export const LESSON_STAGE_IDS: LessonStageId[] = ['video', 'theory', 'quiz', 'traphunter', 'practice'];

// Stages with no module behind them at all. Their status is a CONSTANT,
// never read from storage or any server response, so no amount of stale or
// hand-edited local state can make them look finished. 'quiz' left this set
// in Sprint 06B and 'traphunter' in Sprint 06C; both now have real backends
// (see getStageStatus below).
//
// 'practice' (Advanced Practice) stays. Sprint 06C does not remove, rename,
// implement or unlock it — it is reserved for Sprint 06D, and until then a
// locked tile is the honest thing to show.
const LOCKED_STAGES: LessonStageId[] = ['practice'];

// The subset of a course-quiz-progress row getStageStatus/isLessonComplete
// actually need — matches quizService.CourseQuizProgressRow without this
// file importing the service module (keeps the dependency direction
// service -> progress, not the other way).
export interface QuizStageProgress {
  passed: boolean;
  attemptsCount: number;
}

// Sprint 06C — the same arrangement for Trap Hunter: the subset of
// trapHunterService's progress shape this module needs, declared here rather
// than imported, so the dependency direction stays service -> progress.
export interface TrapHunterStageProgress {
  // Whether a COMPLETED quiz attempt exists to derive traps from. This is
  // what separates 'blocked' (no attempt yet) from 'skipped' (an attempt
  // with zero mistakes) — without it both are just `total: 0`.
  hasSource: boolean;
  total: number;
  cleared: number;
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
//
// INVARIANT A lives here. This function — not isLessonComplete, and
// certainly not a hardcoded list of stage names somewhere else — is the
// single place that decides what a lesson must finish. Sprint 06D adds
// 'practice' to this list and nothing else in the codebase has to change.
export const availableStages = (
  lesson: Pick<Lesson, 'videoUrl' | 'notes' | '_count'>,
  // Sprint 06C. Omitted, or with no traps to clear, 'traphunter' is simply
  // not one of this lesson's stages — which is the correct answer in all
  // three of the cases that produce it: the quiz has not been finished yet
  // ('blocked'), it was finished perfectly ('skipped'), or the lesson has no
  // quiz at all ('unavailable'). None of them is a stage the student owes.
  trapProgress?: TrapHunterStageProgress,
): LessonStageId[] => {
  const stages: LessonStageId[] = [];
  if (lessonHasVideo(lesson)) stages.push('video');
  if (lessonHasTheory(lesson)) stages.push('theory');
  if (lessonHasQuiz(lesson)) stages.push('quiz');
  // `hasSource` as well as `total`, not just `total`: the two travel
  // together from the server, but requiring both means a stale or
  // partially-updated payload can never add a stage the student cannot even
  // open — which would make the lesson permanently incomplete.
  if (lessonHasQuiz(lesson) && trapProgress?.hasSource && trapProgress.total > 0) {
    stages.push('traphunter');
  }
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
  // Sprint 06C — same contract as quizProgress: from the server, optional,
  // and its absence produces the honest "can't start this yet" rather than
  // a guess.
  trapProgress?: TrapHunterStageProgress,
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

  if (stage === 'traphunter') {
    // No quiz means no mistakes to correct — the stage genuinely does not
    // apply to this lesson, exactly as 'video' doesn't to a lesson with no
    // videoUrl.
    if (!lessonHasQuiz(lesson)) return 'unavailable';
    // Not fetched yet, or fetched and there is no completed attempt to
    // derive traps from. Both mean the same thing to the student — finish
    // the quiz first — and 'blocked' says so without claiming the feature
    // is unbuilt.
    if (!trapProgress || !trapProgress.hasSource) return 'blocked';
    // A completed attempt with nothing wrong in it. Earned, not missing.
    if (trapProgress.total === 0) return 'skipped';
    if (trapProgress.cleared >= trapProgress.total) return 'completed';
    return trapProgress.cleared > 0 ? 'in_progress' : 'not_started';
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
//
// INVARIANT A: this body is `stages.every(...)` and stays that way. Sprint
// 06C added Trap Hunter to the completion picture WITHOUT touching a line of
// it — the only thing that changed is what availableStages() returns. Do not
// replace this with an explicit theory && quiz && traphunter conjunction;
// Sprint 06D would have to unpick it to add Advanced Practice.
export const isLessonComplete = (
  userId: string | undefined,
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes' | '_count'>,
  quizProgress?: QuizStageProgress,
  trapProgress?: TrapHunterStageProgress,
): boolean => {
  if (!userId) return false;
  const stages = availableStages(lesson, trapProgress);
  if (stages.length === 0) return false;
  return stages.every(
    (stage) => getStageStatus(userId, lesson, stage, quizProgress, trapProgress) === 'completed',
  );
};

// A lesson is "in progress" once any stage has been touched but not all are
// done — drives the neutral middle badge in lesson lists.
export const isLessonStarted = (
  userId: string | undefined,
  lesson: Pick<Lesson, 'id' | 'videoUrl' | 'notes' | '_count'>,
  quizProgress?: QuizStageProgress,
  trapProgress?: TrapHunterStageProgress,
): boolean => {
  if (!userId) return false;
  return availableStages(lesson, trapProgress).some((stage) => {
    const status = getStageStatus(userId, lesson, stage, quizProgress, trapProgress);
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
  // Sprint 06C — from trapHunterService.getCourseTrapHunterProgress. Omitted,
  // 'traphunter' is not one of any lesson's available stages, so a caller
  // that has not been updated to fetch it behaves EXACTLY as it did before
  // this sprint rather than silently reporting a different percentage.
  trapProgressByLessonId?: Map<string, TrapHunterStageProgress>,
): CourseProgress => {
  const total = lessons.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };
  const completed = lessons.filter((lesson) =>
    isLessonComplete(
      userId,
      lesson,
      quizProgressByLessonId?.get(lesson.id),
      trapProgressByLessonId?.get(lesson.id),
    ),
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
