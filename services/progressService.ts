import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import {
  LessonProgressSnapshot,
  LessonStepsProgress,
  StepProgress,
} from './lessonProgress';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 07 — durable progress for the VIDEO and THEORY steps, plus the
// canonical lesson-level read.
//
// This is the NETWORK half. services/lessonProgress.ts remains a pure function
// library that derives statuses from facts; it never calls a service, and this
// module never derives a status. Keeping the two apart is what stopped the
// client from re-implementing backend rules — see the note there about the
// deleted practicePrerequisitesMet.

// GET /lessons/:lessonId/progress
//
// The lesson page's ONE progress request. It replaces three page-level calls
// and adds the two stages that had no server representation at all before this
// sprint. Read-only: the lesson page calls it on every visit, so a write here
// would record activity for a student who merely looked at the page.
export const getLessonProgress = async (
  lessonId: string,
): Promise<LessonProgressSnapshot> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/progress`);
  if (!response.ok) return throwApiError(response, 'Failed to load lesson progress');
  return response.json();
};

// POST /lessons/:lessonId/steps/video/progress
//
// Monotonic and idempotent server-side: the stored position only ever
// increases, and completion is stamped once and never cleared. Safe to call on
// a timer, on pause, and on unload.
export const recordVideoProgress = async (
  lessonId: string,
  positionSeconds: number,
  durationSeconds: number,
  // Set on the page-unload flush. `keepalive` lets the request outlive the
  // document, which is what a normal fetch cannot do — and unlike
  // navigator.sendBeacon it still carries the Authorization header apiFetch
  // attaches, so the request is actually authenticated.
  options: { keepalive?: boolean } = {},
): Promise<StepProgress> => {
  const response = await apiFetch(
    `${API_BASE_URL}/lessons/${lessonId}/steps/video/progress`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: options.keepalive,
      // Floored because the endpoint takes integers — the player reports
      // fractional seconds and a float is rejected by validation.
      body: JSON.stringify({
        positionSeconds: Math.max(0, Math.floor(positionSeconds)),
        durationSeconds: Math.max(1, Math.floor(durationSeconds)),
      }),
    },
  );
  if (!response.ok) return throwApiError(response, 'Failed to save video progress');
  return response.json();
};

// POST /lessons/:lessonId/steps/theory/start
//
// Fired when the theory pane opens, so it runs on every visit to a lesson the
// student has already read. Idempotent — it never restamps.
export const startTheory = async (lessonId: string): Promise<StepProgress> => {
  const response = await apiFetch(
    `${API_BASE_URL}/lessons/${lessonId}/steps/theory/start`,
    { method: 'POST' },
  );
  if (!response.ok) return throwApiError(response, 'Failed to open theory');
  return response.json();
};

// POST /lessons/:lessonId/steps/theory/complete
//
// The explicit "Tôi đã đọc xong" action, and the ONLY thing that completes
// theory. Scrolling deliberately does not: an accidental scroll should never
// claim a student read something.
export const completeTheory = async (lessonId: string): Promise<StepProgress> => {
  const response = await apiFetch(
    `${API_BASE_URL}/lessons/${lessonId}/steps/theory/complete`,
    { method: 'POST' },
  );
  if (!response.ok) return throwApiError(response, 'Failed to mark theory as read');
  return response.json();
};

// One row per lesson in the course that has any progress-bearing content.
interface CourseStageProgressRow {
  lessonId: string;
  quiz: { passed: boolean; bestScorePercent: number | null; attemptsCount: number } | null;
  trapHunter: { hasSource: boolean; total: number; cleared: number } | null;
  practice: { passed: boolean; bestScorePercent: number | null; attemptsCount: number } | null;
  steps: LessonStepsProgress;
}

// GET /courses/:courseId/stage-progress, mapped to the same snapshot shape the
// lesson page uses.
//
// Sprint 07 — this MOVED here from practiceService, where Sprint 06D first
// added it. It stopped being a practice concern the moment it carried quiz,
// trap, practice AND step progress; leaving it under `practiceService` meant
// three course pages importing a practice module to render a percentage.
//
// It also replaced three separate calls per page (quiz-progress,
// trap-hunter-progress, stage-progress). Those two per-stage endpoints are
// deprecated server-side and deleted in the cleanup sprint.
//
// Returning a Map rather than an array is deliberate: every caller immediately
// keyed by lessonId, and three pages each building the same map three times was
// how the shapes drifted in the first place.
export const getCourseProgressMap = async (
  courseId: string,
): Promise<Map<string, LessonProgressSnapshot>> => {
  const response = await apiFetch(
    `${API_BASE_URL}/courses/${courseId}/stage-progress`,
  );
  if (!response.ok) return throwApiError(response, 'Failed to load course progress');
  const rows: CourseStageProgressRow[] = await response.json();

  return new Map(
    rows.map((row) => [
      row.lessonId,
      {
        steps: row.steps,
        quiz: row.quiz
          ? { passed: row.quiz.passed, attemptsCount: row.quiz.attemptsCount }
          : undefined,
        trapHunter: row.trapHunter ?? undefined,
        // No `availability` here. The course aggregate deliberately does not
        // carry it: this page renders a percentage, and for that 'blocked' and
        // 'not_started' are the same thing — neither is 'completed'.
        practice: row.practice
          ? {
              passed: row.practice.passed,
              attemptsCount: row.practice.attemptsCount,
            }
          : undefined,
      } satisfies LessonProgressSnapshot,
    ]),
  );
};

export type { LessonProgressSnapshot, LessonStepsProgress, StepProgress };
