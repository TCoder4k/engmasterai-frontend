import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import {
  GamificationResult,
  publishGamificationResult,
} from './gamificationService';
import { QuestionDifficulty, QuestionType, QuizQuestionOption, SubmittedAnswer } from './quizService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 06C — Trap Hunter. Mirrors the backend's
// src/lesson/quiz/trap-hunter.types.ts exactly, the same convention
// quizService.ts follows.
//
// Question shapes (QuestionType, QuizQuestionOption, SubmittedAnswer) are
// IMPORTED from quizService rather than redeclared: a trap is one of the
// student's own quiz questions, and two drifting definitions of "what a
// multiple-choice answer looks like" is precisely the bug that would let the
// same answer grade differently in the two stages.

export type TrapHintKind = 'narrow' | 'explanation';

// Discriminated on `shape` so the panel renders each without inferring
// anything from the question type.
export type TrapHintPayload =
  | { shape: 'eliminate'; optionIds: string[] }
  | { shape: 'firstOption'; optionId: string }
  | { shape: 'letters'; length: number; firstCharacter: string }
  | { shape: 'explanation'; text: string };

export interface TrapHint {
  level: number;
  kind: TrapHintKind;
  payload: TrapHintPayload;
}

export interface Trap {
  questionId: string;
  type: QuestionType;
  difficulty: QuestionDifficulty | null;
  content: string;
  options: QuizQuestionOption[] | null;
  audioUrl: string | null;
  imageUrl: string | null;
  // What the student submitted during the quiz — the mistake being
  // corrected. Never regraded client-side; it is shown, not judged.
  wrongAnswer: SubmittedAnswer | null;
  // FAILED correction attempts. Drives the "Need a hint?" nudge from 2 up
  // and nothing else — it is never a penalty and never blocks completion.
  attempts: number;
  hintLevel: number;
  // 0 means this question has no hints at all, and the panel renders no
  // control rather than an empty one.
  hintsAvailable: number;
  // Only the levels already unlocked, so a refresh restores what the student
  // was reading.
  hints: TrapHint[];
  // Present once corrected. Carrying the answer here is earned, not leaked.
  cleared: {
    clearedAt: string;
    correctAnswer: unknown;
    explanation: string | null;
  } | null;
}

export interface TrapHunterProgress {
  // Whether a completed quiz attempt exists to derive traps from — the
  // difference between 'blocked' (finish the quiz first) and 'skipped'
  // (a perfect attempt). See services/lessonProgress.ts.
  hasSource: boolean;
  total: number;
  cleared: number;
  completed: boolean;
}

export interface GetTrapHunterResponse {
  traps: Trap[];
  progress: TrapHunterProgress;
}

export interface AnswerTrapInput {
  questionId: string;
  submitted: SubmittedAnswer;
}

export interface AnswerTrapResponse {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
  attempts: number;
  clearedCount: number;
  totalCount: number;
  // Consecutive traps cleared first try, counted server-side.
  currentStreak: number;
  allCleared: boolean;
  // Sprint 10. Clearing a trap earns XP but does NOT create an activity day —
  // Trap Hunter is invisible to the dashboard's streak scan and Sprint 10
  // deliberately kept it that way rather than silently lighting up calendar
  // tiles that never lit up before.
  gamification?: GamificationResult;
}

export interface RequestTrapHintInput {
  questionId: string;
  level: number;
}

export interface TrapHintResponse {
  questionId: string;
  hints: TrapHint[];
  hintLevel: number;
  hintsAvailable: number;
}

export interface CourseTrapHunterProgressRow {
  lessonId: string;
  hasSource: boolean;
  total: number;
  cleared: number;
}

export const getTrapHunter = async (lessonId: string): Promise<GetTrapHunterResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/trap-hunter`);
  if (!response.ok) return throwApiError(response, 'Failed to load Trap Hunter');
  return response.json();
};

// Grades ONE correction. The response carries the correct answer because the
// student has just committed to theirs — the same "the reveal is earned"
// rule the quiz's answer endpoint follows.
export const answerTrap = async (
  lessonId: string,
  dto: AnswerTrapInput,
): Promise<AnswerTrapResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/trap-hunter/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to check that correction');
  const body: AnswerTrapResponse = await response.json();
  publishGamificationResult(body.gamification);
  return body;
};

export const requestTrapHint = async (
  lessonId: string,
  dto: RequestTrapHintInput,
): Promise<TrapHintResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/trap-hunter/hint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to load that hint');
  return response.json();
};

export const getCourseTrapHunterProgress = async (
  courseId: string,
): Promise<{ data: CourseTrapHunterProgressRow[] }> => {
  const response = await apiFetch(`${API_BASE_URL}/courses/${courseId}/trap-hunter-progress`);
  if (!response.ok) return throwApiError(response, 'Failed to load Trap Hunter progress');
  return response.json();
};
