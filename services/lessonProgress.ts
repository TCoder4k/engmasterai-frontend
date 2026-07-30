import { Lesson } from '../types';
import { parseGrammarNotes } from '../components/lesson/grammar/parseGrammarNotes';

// Sprint 06 — the single source of truth for "how far through a lesson is
// this student".
//
// WHY COMPLETION AND NOT "WATCHED":
// A Lesson is Video -> Theory -> Quiz -> Trap Hunter -> Advanced Practice. If
// the UI counted *videos watched*, every stage added later would force the
// roadmap card, the course hero and the lesson list to be rewritten. So the
// unit exposed to the UI is a COMPLETED LESSON — every stage that lesson
// actually has, finished — and `isLessonComplete` is the only place that
// definition lives.
//
// SPRINT 07 — THIS MODULE NO LONGER OWNS ANY STATE.
//
// It used to read `video` and `theory` completion straight out of localStorage,
// which made two of the five stages that gate lesson completion device-local,
// client-forgeable and invisible to the server. A lesson finished on a laptop
// read as unfinished on a phone, permanently, and hand-writing two keys in
// DevTools marked a lesson complete and raised the course percentage.
//
// Every input is now server state, passed in by the caller. This module is a
// PURE function library: it derives statuses from facts it is given and calls
// no network and no storage. The dependency direction stays service ->
// progress, never the reverse.
//
// INVARIANT A — LESSON COMPLETION IS STAGE-DRIVEN AND DYNAMIC.
// isLessonComplete asks `availableStages(lesson).every(completed)` and must
// keep asking exactly that. It must never be rewritten as a hardcoded
// conjunction such as:
//
//     theoryCompleted && quizPassed && trapHunterCompleted   // FORBIDDEN
//
// Each stage is one more entry in a list. Sprint 06D widened completion to
// Advanced Practice with zero changes to this body, and Sprint 07 moved two
// stages onto the server with zero changes to it either. lessonProgress.test.ts
// pins this directly.

export type LessonStageId = 'video' | 'theory' | 'quiz' | 'traphunter' | 'practice';

// Sprint 06C added 'blocked' and 'skipped'. Before that, one status was
// doing three different jobs, and two of them were misleading.
export type StageStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  // No backend exists for this stage at all — it is not merely unstarted.
  // Renders "Coming soon". As of Sprint 06D no stage is in this state; it is
  // kept for the case of a stage shipping in the UI before its module does.
  | 'locked'
  // A REAL, live stage whose prerequisite is not met yet — Advanced Practice
  // before the quiz has been passed. Deliberately not 'locked': that renders
  // "Coming soon" and would tell a student a shipped feature does not exist.
  | 'blocked'
  // The stage exists in principle but this particular lesson has no content
  // for it (no videoUrl, no published quiz). Never counted toward completion.
  | 'unavailable'
  // The stage ran its course and had nothing to do: a quiz answered with no
  // mistakes leaves Trap Hunter with no traps. Distinct from 'unavailable'
  // ("not in this lesson"), which is a deflating thing to show someone who
  // just scored 100%. Never counted toward completion either.
  | 'skipped';

// Ordered as the student meets them.
export const LESSON_STAGE_IDS: LessonStageId[] = ['video', 'theory', 'quiz', 'traphunter', 'practice'];

// --- Server-sourced progress shapes -----------------------------------------
//
// These mirror the backend's LessonProgressDto (src/lesson/progress/
// lesson-progress.types.ts) without importing a service module, so the
// dependency direction stays service -> progress.

// Sprint 07 — VIDEO and THEORY, now real server state.
//
// There is deliberately no `status` field, on either side of the wire: state is
// DERIVED from the two timestamps. A stored status beside the timestamps it is
// computed from is a second representation of one fact, which is precisely how
// the backend's LessonTaskProgress.status came to disagree with completedAt.
export interface StepProgress {
  startedAt: string | null;
  completedAt: string | null;
  highestPositionSeconds?: number | null;
  videoDurationSeconds?: number | null;
}

export interface LessonStepsProgress {
  video: StepProgress | null;
  theory: StepProgress | null;
}

export interface QuizStageProgress {
  passed: boolean;
  attemptsCount: number;
}

export interface TrapHunterStageProgress {
  // Whether a COMPLETED quiz attempt exists to derive traps from. This is
  // what separates 'blocked' (no attempt yet) from 'skipped' (an attempt with
  // zero mistakes) — without it both are just `total: 0`.
  hasSource: boolean;
  total: number;
  cleared: number;
}

export type PracticeAvailability =
  | { state: 'available' }
  | { state: 'unavailable'; reason: 'no_published_task' }
  | { state: 'blocked'; reason: 'quiz_not_passed' | 'traps_outstanding' };

export interface PracticeStageProgress {
  passed: boolean;
  attemptsCount: number;
  // Sprint 07 — the SERVER's answer to "may this student start Practice yet".
  //
  // This module used to compute it from quiz and trap progress, in a
  // hand-maintained mirror of the backend's practice-prerequisites.ts. Two
  // implementations of one rule drift; the client copy is gone.
  //
  // Optional because only the LESSON aggregate carries it. The course
  // aggregate deliberately does not: a course page renders a percentage, and
  // for that purpose 'blocked' and 'not_started' are the same thing (neither
  // is 'completed'), so shipping the field there would add payload for a
  // distinction nothing draws.
  availability?: PracticeAvailability;
}

// Everything getStageStatus needs, in one object.
//
// Sprint 07 collapsed four positional progress parameters into this. Five
// optional positionals in a fixed order is an argument-order bug waiting to
// happen, and every call site had to change for the `steps` addition anyway.
// It also mirrors the backend's GET /lessons/:id/progress payload exactly, so
// the wire response is very nearly this object already.
export interface LessonProgressSnapshot {
  steps?: LessonStepsProgress;
  quiz?: QuizStageProgress;
  trapHunter?: TrapHunterStageProgress;
  practice?: PracticeStageProgress;
}

// --- What a lesson actually offers -----------------------------------------

export const lessonHasVideo = (lesson: Pick<Lesson, 'videoUrl'>): boolean =>
  Boolean(lesson.videoUrl && lesson.videoUrl.trim());

export const lessonHasTheory = (lesson: Pick<Lesson, 'notes'>): boolean => {
  const parsed = parseGrammarNotes(lesson.notes);
  return parsed.sections.length > 0 || Boolean(parsed.fallbackText);
};

// Sprint 06B — real signal from the backend (LessonService's USER_SELECT
// reports published task types only), not a guess. A lesson with no quiz
// authored/published never gains a 'quiz' stage, exactly like a lesson with no
// video never gains a 'video' stage.
export const lessonHasQuiz = (
  lesson: Pick<Lesson, 'publishedTaskTypes'>,
): boolean => (lesson.publishedTaskTypes ?? []).includes('QUIZ');

// Sprint 06D — the same signal, one entry along. A lesson without an authored
// and published Practice task never gains a 'practice' stage, so it can still
// reach 100% without one: a missing task must never create a requirement that
// cannot be satisfied.
export const lessonHasPractice = (
  lesson: Pick<Lesson, 'publishedTaskTypes'>,
): boolean => (lesson.publishedTaskTypes ?? []).includes('PRACTICE');

type LessonShape = Pick<Lesson, 'id' | 'videoUrl' | 'notes' | 'publishedTaskTypes'>;

// --- Which stages this lesson actually has ----------------------------------

export const availableStages = (
  lesson: Pick<Lesson, 'videoUrl' | 'notes' | 'publishedTaskTypes'>,
  trapProgress?: TrapHunterStageProgress,
): LessonStageId[] => {
  const stages: LessonStageId[] = [];
  if (lessonHasVideo(lesson)) stages.push('video');
  if (lessonHasTheory(lesson)) stages.push('theory');
  if (lessonHasQuiz(lesson)) stages.push('quiz');
  // Trap Hunter only becomes a requirement once an attempt has actually
  // produced traps — a perfect quiz must not leave a stage that can never be
  // completed.
  if (lessonHasQuiz(lesson) && trapProgress?.hasSource && trapProgress.total > 0) {
    stages.push('traphunter');
  }
  if (lessonHasPractice(lesson)) stages.push('practice');
  return stages;
};

// --- Per-stage status -------------------------------------------------------

// `progress` is OPTIONAL and comes entirely from the server. Omitted or
// partially filled, each stage reports the honest "not started yet" rather
// than a fabricated 'completed': a caller that has not been updated to fetch a
// given stage shows a STALE status, never a wrong one.
export const getStageStatus = (
  userId: string | undefined,
  lesson: LessonShape,
  stage: LessonStageId,
  progress?: LessonProgressSnapshot,
): StageStatus => {
  if (!userId) return 'not_started';

  if (stage === 'video') {
    if (!lessonHasVideo(lesson)) return 'unavailable';
    return stepStatus(progress?.steps?.video);
  }

  if (stage === 'theory') {
    if (!lessonHasTheory(lesson)) return 'unavailable';
    return stepStatus(progress?.steps?.theory);
  }

  if (stage === 'quiz') {
    if (!lessonHasQuiz(lesson)) return 'unavailable';
    // The lesson DOES have a quiz here — undefined means "not fetched yet",
    // not "doesn't exist", so 'not_started' is the honest default until real
    // data arrives.
    const quiz = progress?.quiz;
    if (!quiz) return 'not_started';
    if (quiz.passed) return 'completed';
    return quiz.attemptsCount > 0 ? 'in_progress' : 'not_started';
  }

  if (stage === 'traphunter') {
    // No quiz means no mistakes to correct — the stage genuinely does not
    // apply, exactly as 'video' doesn't to a lesson with no videoUrl.
    if (!lessonHasQuiz(lesson)) return 'unavailable';
    const trap = progress?.trapHunter;
    // Not fetched yet, or fetched and there is no completed attempt to derive
    // traps from. Both mean the same thing to the student — finish the quiz
    // first — and 'blocked' says so without claiming the feature is unbuilt.
    if (!trap || !trap.hasSource) return 'blocked';
    // A completed attempt with nothing wrong in it. Earned, not missing.
    if (trap.total === 0) return 'skipped';
    if (trap.cleared >= trap.total) return 'completed';
    return trap.cleared > 0 ? 'in_progress' : 'not_started';
  }

  if (stage === 'practice') {
    // No authored, published Practice task — the stage does not apply and is
    // not something the student owes.
    if (!lessonHasPractice(lesson)) return 'unavailable';
    const practice = progress?.practice;
    // Sprint 07 — the SERVER decides this now. Absent (course aggregate, or
    // simply not fetched), we fall through to the progress-based status, which
    // is never 'completed' for a blocked stage anyway.
    if (practice?.availability?.state === 'blocked') return 'blocked';
    if (!practice) return 'not_started';
    if (practice.passed) return 'completed';
    return practice.attemptsCount > 0 ? 'in_progress' : 'not_started';
  }

  // Sprint 06D — EXHAUSTIVENESS GUARD, and the replacement for the old
  // LOCKED_STAGES constant.
  //
  // Every LessonStageId is handled above, so `stage` is `never` here. Add a
  // sixth stage id and this line stops compiling until it gets a real branch —
  // which is the whole point: a `return 'not_started'` fallthrough would
  // silently report a stage with no backend as merely unstarted, making it look
  // startable and (via availableStages) potentially blocking completion
  // forever. A build error is a much better failure than that.
  const exhaustive: never = stage;
  return exhaustive;
};

// Sprint 07 — the one place a step's three states are derived, so video and
// theory can never disagree about what "started" means.
const stepStatus = (step: StepProgress | null | undefined): StageStatus => {
  if (!step) return 'not_started';
  if (step.completedAt) return 'completed';
  if (step.startedAt) return 'in_progress';
  return 'not_started';
};

// --- Lesson and course completion ------------------------------------------

// THE seam. A lesson is complete when EVERY stage it offers is complete — not
// when its video ended. A lesson with notes stays incomplete until the theory
// is marked read, which is exactly the case a "watched" model gets wrong.
//
// INVARIANT A: this body is `stages.every(...)` and stays that way.
export const isLessonComplete = (
  userId: string | undefined,
  lesson: LessonShape,
  progress?: LessonProgressSnapshot,
): boolean => {
  if (!userId) return false;
  const stages = availableStages(lesson, progress?.trapHunter);
  if (stages.length === 0) return false;
  return stages.every(
    (stage) => getStageStatus(userId, lesson, stage, progress) === 'completed',
  );
};

// A lesson is "in progress" once any stage has been touched but not all are
// done — drives the neutral middle badge in lesson lists.
export const isLessonStarted = (
  userId: string | undefined,
  lesson: LessonShape,
  progress?: LessonProgressSnapshot,
): boolean => {
  if (!userId) return false;
  return availableStages(lesson, progress?.trapHunter).some((stage) => {
    const status = getStageStatus(userId, lesson, stage, progress);
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
  lessons: LessonShape[],
  // Sprint 07 — ONE map keyed by lessonId, from
  // practiceService.getCourseStageProgress. It replaced three parallel maps
  // (quiz, trap, practice) that every caller had to build and pass in the
  // right order, and it now also carries the video/theory steps those callers
  // previously read from localStorage.
  progressByLessonId?: Map<string, LessonProgressSnapshot>,
): CourseProgress => {
  const total = lessons.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };
  const completed = lessons.filter((lesson) =>
    isLessonComplete(userId, lesson, progressByLessonId?.get(lesson.id)),
  ).length;
  // floor, matching the Learning Engine's percentages (ADR 007 §5) — a single
  // finished lesson out of 20 must not round up to look like more.
  return { completed, total, percent: Math.floor((completed / total) * 100) };
};

// --- Legacy cleanup (Sprint 07, temporary) ----------------------------------

// Sprint 07 moved video and theory to the server and DISCARDED the device-local
// records rather than importing them: those values were always client-writable,
// so importing would have turned forged keys into real database rows and
// laundered them permanently. Students re-complete video and theory once; every
// graded stage (quiz, Trap Hunter, Practice) was already server-side and is
// untouched.
//
// Called once at app boot. Nothing writes these keys any more, so there is no
// race and no need for a version marker — this simply removes what is left.
// DELETE THIS FUNCTION AND ITS CALL SITE in the cleanup sprint, once every
// active session has booted at least once against a Sprint 07 build.
export const purgeLegacyLocalProgress = (): void => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('lessonStages:') || key.startsWith('videoProgress:')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // A full or unavailable localStorage must never stop the app from booting.
  }
};
