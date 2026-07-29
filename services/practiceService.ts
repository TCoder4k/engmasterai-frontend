import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import {
  AnswerQuestionResponse,
  ManageQuiz,
  QuizFeedbackMode,
  StudentQuiz,
  SubmitQuizInput,
  SubmitQuizResponse,
  UpsertQuizInput,
} from './quizService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 06D — Advanced Practice. Mirrors the backend's
// src/lesson/quiz/practice.types.ts exactly, the same convention
// quizService.ts and trapHunterService.ts follow.
//
// The question, answer and grading shapes are IMPORTED from quizService
// rather than redeclared. Advanced Practice IS the quiz engine pointed at a
// different LessonTask, so two drifting definitions of "what a submitted
// answer looks like" would be a bug waiting to happen — the same reasoning
// that made Trap Hunter import them too.

export type PracticeBlockedReason = 'quiz_not_passed' | 'traps_outstanding';

// Why the student can or cannot start. The GET always succeeds and reports
// this rather than refusing, so the UI can say WHICH prerequisite is missing
// instead of showing a generic lock.
export type PracticeAvailability =
  | { state: 'available' }
  | { state: 'unavailable'; reason: 'no_published_task' }
  | { state: 'blocked'; reason: PracticeBlockedReason };

// Everything the intro screen needs. Real authored numbers only — there is
// deliberately no estimated duration, because none is stored and inventing
// one would put a fabricated number in front of a student.
export interface PracticeTaskSummary {
  taskId: string;
  questionCount: number;
  passingScorePercent: number;
  feedbackMode: QuizFeedbackMode;
}

export interface PracticeProgress {
  attemptsCount: number;
  bestScorePercent: number | null;
  passed: boolean;
  lastDurationSeconds: number | null;
}

export interface GetPracticeResponse {
  availability: PracticeAvailability;
  task: PracticeTaskSummary | null;
  progress: PracticeProgress;
  // Non-null ONLY when an attempt is genuinely in flight. Reading the stage
  // never starts one, so this stays null until Start Practice is pressed.
  attempt: StudentQuiz | null;
}

export interface StartPracticeResponse {
  task: PracticeTaskSummary;
  progress: PracticeProgress;
  attempt: StudentQuiz;
}

export interface CourseStageProgressRow {
  lessonId: string;
  quiz: { passed: boolean; bestScorePercent: number | null; attemptsCount: number } | null;
  trapHunter: { hasSource: boolean; total: number; cleared: number } | null;
  practice: { passed: boolean; bestScorePercent: number | null; attemptsCount: number } | null;
}

// GET is safe to call from anywhere — it writes nothing on the server.
export const getPractice = async (lessonId: string): Promise<GetPracticeResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice`);
  if (!response.ok) return throwApiError(response, 'Failed to load Advanced Practice');
  return response.json();
};

// The explicit start. Idempotent server-side: calling it twice returns the
// same in-flight attempt rather than restarting the clock.
export const startPractice = async (lessonId: string): Promise<StartPracticeResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice/start`, {
    method: 'POST',
  });
  if (!response.ok) return throwApiError(response, 'Failed to start Advanced Practice');
  return response.json();
};

export const answerPracticeQuestion = async (
  lessonId: string,
  dto: { questionId: string; clientAttemptId: string; submitted: unknown },
): Promise<AnswerQuestionResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to check that answer');
  return response.json();
};

export const submitPractice = async (
  lessonId: string,
  dto: SubmitQuizInput,
): Promise<SubmitQuizResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to submit Advanced Practice');
  return response.json();
};

// One request per course covering every stage that has a backend, replacing
// the need to call quiz-progress and trap-hunter-progress separately.
export const getCourseStageProgress = async (
  courseId: string,
): Promise<CourseStageProgressRow[]> => {
  const response = await apiFetch(`${API_BASE_URL}/courses/${courseId}/stage-progress`);
  if (!response.ok) return throwApiError(response, 'Failed to load stage progress');
  return response.json();
};

// --- Admin authoring --------------------------------------------------------
//
// The same five operations the quiz editor already performs, against the
// practice task instead. The DTOs are IMPORTED from quizService, not
// redeclared: the backend serves both through one parameterised service, so a
// second definition of "what a question looks like" here would be a place for
// the two editors to drift apart while the API stayed identical.

export const getManagePractice = async (lessonId: string): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice/manage`);
  if (!response.ok) return throwApiError(response, 'Failed to load Advanced Practice');
  return response.json();
};

export const upsertPractice = async (
  lessonId: string,
  dto: UpsertQuizInput,
): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to save Advanced Practice');
  return response.json();
};

export const publishPractice = async (lessonId: string): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice/publish`, {
    method: 'PATCH',
  });
  if (!response.ok) return throwApiError(response, 'Failed to publish Advanced Practice');
  return response.json();
};

export const unpublishPractice = async (lessonId: string): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice/unpublish`, {
    method: 'PATCH',
  });
  if (!response.ok) return throwApiError(response, 'Failed to unpublish Advanced Practice');
  return response.json();
};

export const deletePractice = async (lessonId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/practice`, {
    method: 'DELETE',
  });
  if (!response.ok) return throwApiError(response, 'Failed to delete Advanced Practice');
};
