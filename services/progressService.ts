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

// Sprint 08 — `getCourseProgressMap` was DELETED from here.
//
// It fetched GET /courses/:courseId/stage-progress and handed three course
// pages a bag of raw stage rows, which each of them then rolled up into a
// percentage with services/lessonProgress. That roll-up was the last place a
// course percentage was decided in the browser.
//
// Its replacement is services/courseProgressService.ts, which asks the server
// for the ANSWER rather than the ingredients — one batch request for every
// course on a page, instead of one request per course. The endpoint it called
// is deprecated server-side and goes in the cleanup sprint.

export type { LessonProgressSnapshot, LessonStepsProgress, StepProgress };
