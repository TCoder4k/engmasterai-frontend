import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import { CefrLevel, CourseType, LearningGoal, LevelSource } from '../types';
import {
  QuestionType,
  QuestionDifficulty,
  QuizQuestionOption,
  SubmittedAnswer,
} from './quizService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Personalized Onboarding & Placement Test — the admin question bank
// (Phase 2). QuestionType/QuestionDifficulty/QuizQuestionOption are reused
// directly from quizService.ts rather than redeclared: PlacementQuestion's
// content shape is deliberately identical to the lesson quiz engine's
// Question, so grade-question.ts's validators work unmodified on both.
export interface ManagedPlacementQuestion {
  id: string;
  section: CourseType;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  content: string;
  options: QuizQuestionOption[] | null;
  correctAnswer: unknown;
  explanation: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedPlacementQuestionListResponse {
  data: ManagedPlacementQuestion[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PlacementQuestionInput {
  section: CourseType;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  content: string;
  options?: QuizQuestionOption[];
  correctAnswer: unknown;
  explanation?: string;
  audioUrl?: string;
  imageUrl?: string;
}

export interface PlacementCoverageBucket {
  section: CourseType;
  difficulty: QuestionDifficulty;
  required: number;
  available: number;
  sufficient: boolean;
}

export interface PlacementCoverage {
  buckets: PlacementCoverageBucket[];
  ready: boolean;
}

// --- Admin: question bank (ADMIN role required server-side) ---

export const getManagedPlacementQuestions = async (
  section?: CourseType,
  difficulty?: QuestionDifficulty,
  page?: number,
  limit?: number,
): Promise<ManagedPlacementQuestionListResponse> => {
  const params = new URLSearchParams();
  if (section) params.set('section', section);
  if (difficulty) params.set('difficulty', difficulty);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  const query = params.toString();
  const response = await apiFetch(
    `${API_BASE_URL}/placement/questions/manage${query ? `?${query}` : ''}`,
  );
  if (!response.ok) return throwApiError(response, 'Failed to load placement questions');
  return response.json();
};

export const getPlacementCoverage = async (): Promise<PlacementCoverage> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/questions/manage/coverage`);
  if (!response.ok) return throwApiError(response, 'Failed to load placement bank coverage');
  return response.json();
};

export const createPlacementQuestion = async (
  dto: PlacementQuestionInput,
): Promise<ManagedPlacementQuestion> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/questions/manage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to create placement question');
  return response.json();
};

export const updatePlacementQuestion = async (
  id: string,
  dto: Partial<PlacementQuestionInput>,
): Promise<ManagedPlacementQuestion> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/questions/manage/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to update placement question');
  return response.json();
};

export const publishPlacementQuestion = async (
  id: string,
): Promise<ManagedPlacementQuestion> => {
  const response = await apiFetch(
    `${API_BASE_URL}/placement/questions/manage/${id}/publish`,
    { method: 'PATCH' },
  );
  if (!response.ok) return throwApiError(response, 'Failed to publish placement question');
  return response.json();
};

export const unpublishPlacementQuestion = async (
  id: string,
): Promise<ManagedPlacementQuestion> => {
  const response = await apiFetch(
    `${API_BASE_URL}/placement/questions/manage/${id}/unpublish`,
    { method: 'PATCH' },
  );
  if (!response.ok) return throwApiError(response, 'Failed to unpublish placement question');
  return response.json();
};

export const deletePlacementQuestion = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/questions/manage/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) return throwApiError(response, 'Failed to delete placement question');
};

// --- Student: onboarding + placement test flow (Phase 5) ---
//
// Mirrors engmasterai-backend/src/placement/placement.types.ts exactly.
// SubmittedAnswer is reused from quizService.ts (same four shapes
// grade-question.ts defines) rather than redeclared — Placement's answer
// endpoint accepts the identical shapes.

// Invariant 9's discipline, restated: no correctAnswer, no explanation.
// Correctness is never disclosed before POST .../submit finalizes the
// attempt.
export interface StudentPlacementQuestion {
  id: string;
  section: CourseType;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  content: string;
  options: QuizQuestionOption[] | null;
  audioUrl: string | null;
  // Listening-section items only. Spoken dialogue for client-side TTS
  // playback — the server never puts this text in `content`, so it must
  // never be rendered as visible text (that would leak the audio's script).
  // Null once a real recorded audioUrl exists for the question.
  transcript: string | null;
  imageUrl: string | null;
}

export interface PlacementAnswerState {
  questionId: string;
  submitted: SubmittedAnswer;
}

export interface PlacementAttemptState {
  attemptId: string;
  goal: LearningGoal | null;
  startedAt: string;
  expiresAt: string;
  questions: StudentPlacementQuestion[];
  answers: PlacementAnswerState[];
}

export interface PlacementResult {
  attemptId: string;
  grammarScore: number;
  vocabularyScore: number;
  listeningScore: number;
  overallScore: number;
  estimatedLevel: CefrLevel;
  // Authoritative per-section counts — render these directly ("5 / 8 câu
  // đúng"), never re-derive a count from the rounded score above (lossy
  // once a section has more than 4 questions).
  grammarCorrect: number;
  grammarTotal: number;
  vocabularyCorrect: number;
  vocabularyTotal: number;
  listeningCorrect: number;
  listeningTotal: number;
  durationSeconds: number | null;
  completedAt: string;
}

// Wizard-internal resume authority — called ONLY from inside the
// onboarding wizard, never from the app-wide OnboardingGateBoundary (which
// reads GET /users/me's synchronous `onboarded` field instead).
export interface PlacementStatus {
  onboarded: boolean;
  learningGoal: LearningGoal | null;
  hasInProgressAttempt: boolean;
  attemptExpiresAt: string | null;
  hasRoadmap: boolean;
}

export type RoadmapPillar = CourseType;
export type RoadmapResourceType = 'COURSE' | 'VOCAB_LIBRARY' | 'LISTENING_CATEGORY';

export interface RoadmapItemView {
  phase: number;
  pillar: RoadmapPillar;
  resourceType: RoadmapResourceType;
  resourceId: string;
  // Joined fresh from a LIVE Course/VocabLibrary/ListeningCategory row on
  // every read — never a stale snapshot. See engmasterai-backend's
  // roadmap-algorithm.ts.
  resourceTitle: string;
  resourceThumbnail: string | null;
  reason: string;
  // Sum of estimatedStudyMinutes across the course's published lessons —
  // real, measured content-authoring data. NOT a promise about how long the
  // student will take; callers derive an explicitly-labeled "~X tuần"
  // ESTIMATE from this, never present it as exact. Always 0 for
  // VOCAB_LIBRARY/LISTENING_CATEGORY items — no equivalent aggregate exists
  // for those resource types.
  totalEstimatedMinutes: number;
}

export interface RoadmapView {
  goal: LearningGoal;
  estimatedLevel: CefrLevel | null;
  // Null only for a roadmap generated before this field existed.
  levelSource: LevelSource | null;
  // Null on the beginner-skip path — no test was ever taken.
  placementAttemptId: string | null;
  generatedAt: string;
  // Populated by POST /placement/roadmap/analysis; null until that has been
  // called, and cleared again whenever a retake regenerates the roadmap
  // (see the backend's finalizeNow/persistRoadmapAndMaybeOnboard).
  aiSummary: string | null;
  // True only when POST /placement/roadmap/plan actually persisted an
  // AI-selected `items`; false for the deterministic roadmap — whether AI
  // planning was never asked for, failed, or returned an invalid selection.
  // Both are equally real, valid roadmaps; this is purely informational.
  aiPlanningUsed: boolean;
  items: RoadmapItemView[];
}

// POST /placement/roadmap/analysis — Phase 6. Checked-before-called caching:
// `cached: true` means this was the stored answer, not a fresh (paid) call.
export interface RoadmapAnalysisResult {
  summary: string;
  generatedAt: string;
  model: string;
  cached: boolean;
}

// PUT /placement/goal — always allowed, even after onboarding (a
// "regenerate roadmap" affordance can call start/start-beginner again
// afterward).
export const setPlacementGoal = async (
  goal: LearningGoal,
): Promise<{ learningGoal: LearningGoal }> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/goal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to set learning goal');
  return response.json();
};

// Skip-test path — generates a roadmap from the goal alone and onboards
// immediately.
export const startBeginnerPlacement = async (): Promise<{
  goal: LearningGoal;
  roadmapGenerated: boolean;
}> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/start-beginner`, {
    method: 'POST',
  });
  if (!response.ok) return throwApiError(response, 'Failed to start the beginner path');
  return response.json();
};

// Idempotent server-side: an attempt already in flight is returned
// UNCHANGED (including its original expiresAt), so calling this again on
// refresh never resets the timer.
export const startPlacementTest = async (): Promise<PlacementAttemptState> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/start`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to start the placement test');
  return response.json();
};

// 404 (surfaced as ApiError with status 404) means there is no in-progress
// attempt right now — callers branch on `err.status`, not on message text.
export const getPlacementAttempt = async (): Promise<PlacementAttemptState> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/attempt`);
  if (!response.ok) return throwApiError(response, 'Failed to load the placement attempt');
  return response.json();
};

export const answerPlacementQuestion = async (
  attemptId: string,
  questionId: string,
  submitted: SubmittedAnswer,
): Promise<{ questionId: string; recorded: boolean }> => {
  const response = await apiFetch(
    `${API_BASE_URL}/placement/attempt/${attemptId}/answer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, submitted }),
    },
  );
  if (!response.ok) return throwApiError(response, 'Failed to record the answer');
  return response.json();
};

// No body — the graded answer set is always derived server-side from
// whatever PlacementAnswer rows already exist for this attempt (see the
// backend's submit() for why). Safe to call again: an already-completed
// attempt replays its stored result rather than re-grading.
export const submitPlacementAttempt = async (
  attemptId: string,
): Promise<PlacementResult> => {
  const response = await apiFetch(
    `${API_BASE_URL}/placement/attempt/${attemptId}/submit`,
    { method: 'POST' },
  );
  if (!response.ok) return throwApiError(response, 'Failed to submit the placement test');
  return response.json();
};

// "Xem chi tiết bài làm" on the Result screen. Unlike StudentPlacementQuestion
// (which never carries correctAnswer/explanation — Invariant 9, while an
// attempt is still in progress), this is deliberately POST-completion only:
// the server rejects with a 409 if the attempt isn't finished yet.
export interface PlacementReviewItem {
  questionId: string;
  section: CourseType;
  type: QuestionType;
  content: string;
  options: QuizQuestionOption[] | null;
  audioUrl: string | null;
  transcript: string | null;
  imageUrl: string | null;
  submitted: SubmittedAnswer | null;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
}

export interface PlacementReview {
  attemptId: string;
  items: PlacementReviewItem[];
}

export const getPlacementAttemptReview = async (
  attemptId: string,
): Promise<PlacementReview> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/attempt/${attemptId}/review`);
  if (!response.ok) return throwApiError(response, 'Failed to load the test review');
  return response.json();
};

export const getPlacementRoadmap = async (): Promise<RoadmapView> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/roadmap`);
  if (!response.ok) return throwApiError(response, 'Failed to load the roadmap');
  return response.json();
};

// No body — the server derives everything it needs (goal, level, section
// scores, the finished phase list) from the caller's own stored Roadmap/
// PlacementAttempt rows. Cheap to call again: an already-narrated roadmap
// returns the cached answer instead of paying for a second generation.
export const requestPlacementRoadmapAnalysis = async (): Promise<RoadmapAnalysisResult> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/roadmap/analysis`, {
    method: 'POST',
  });
  if (!response.ok) return throwApiError(response, 'Failed to generate the AI roadmap analysis');
  return response.json();
};

// POST /placement/roadmap/plan — hybrid AI-assisted course SELECTION (not
// narration). No body, same reasoning as the analysis call above. Always
// resolves with a valid RoadmapView, whether or not AI planning actually
// ran — `aiPlanningUsed` says which; a rejected promise here means a real
// error (network/auth/rate-limit), never "AI was unavailable" — that case
// still resolves successfully with the deterministic roadmap.
export const requestPlacementRoadmapPlan = async (): Promise<RoadmapView> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/roadmap/plan`, {
    method: 'POST',
  });
  if (!response.ok) return throwApiError(response, 'Failed to build the AI-personalized roadmap');
  return response.json();
};

export const getPlacementStatus = async (): Promise<PlacementStatus> => {
  const response = await apiFetch(`${API_BASE_URL}/placement/status`);
  if (!response.ok) return throwApiError(response, 'Failed to load onboarding status');
  return response.json();
};
