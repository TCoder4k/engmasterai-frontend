import { throwApiError, ApiError } from './apiError';
import { apiFetch } from './apiFetch';
import {
  GamificationResult,
  publishGamificationResult,
} from './gamificationService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 06B — Lesson Quiz Engine. Mirrors the backend's
// src/lesson/quiz/quiz.types.ts and grade-question.ts shapes exactly; any
// drift between the two is exactly the kind of bug the student payload's
// Invariant 9 (no correctAnswer/explanation) exists to catch.
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'ORDERING';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuizQuestionOption {
  id: string;
  text: string;
}

// The four submitted-answer shapes a student's client can send — one per
// QuestionType, matching grade-question.ts's per-type Submission types.
export type SubmittedAnswer =
  | { optionId: string }
  | { value: boolean }
  | { text: string }
  | { orderedOptionIds: string[] };

// Sprint 06B.5 — when a quiz tells the student whether they were right.
// A property of the QUIZ, never of the course type: nothing in this engine
// branches on whether the lesson is Grammar, Vocabulary or Listening.
export type QuizFeedbackMode = 'IMMEDIATE' | 'ON_SUBMIT';

// Present only for a question already answered in the CURRENT attempt.
// Not a leak: the student saw all of this the moment they answered, and it
// is what lets a mid-quiz refresh restore the feedback they were reading.
export interface AnsweredQuestionState {
  submitted: SubmittedAnswer | null;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
}

export interface StudentQuizQuestion {
  id: string;
  type: QuestionType;
  difficulty: QuestionDifficulty | null;
  content: string;
  options: QuizQuestionOption[] | null;
  audioUrl: string | null;
  // Optional — only ever set for placement's Listening questions (see
  // StudentPlacementQuestion.transcript). Every other caller of this shared
  // type (lesson quizzes, AdvancedPracticeStage) leaves it undefined.
  transcript?: string | null;
  imageUrl: string | null;
  orderIndex: number;
  // Null for every question the student has not answered yet — those carry
  // no correctAnswer and no explanation at all (Invariant 9, 06B.5 form).
  answered: AnsweredQuestionState | null;
}

export interface StudentQuiz {
  taskId: string;
  passingScorePercent: number;
  feedbackMode: QuizFeedbackMode;
  /**
   * The attempt id the server is already recording answers against, or null
   * when no attempt is in flight. Adopt it — the answer endpoint restarts
   * the record for an id it does not recognise, so inventing one after a
   * lost draft throws away everything answered so far.
   *
   * Optional in the type only so a client built against an older backend
   * still compiles; the current API always sends it.
   */
  currentAttemptId?: string | null;
  questions: StudentQuizQuestion[];
}

export interface StudentQuizProgress {
  attemptsCount: number;
  bestScorePercent: number | null;
  passed: boolean;
  lastDurationSeconds: number | null;
}

export interface GetQuizResponse {
  quiz: StudentQuiz;
  progress: StudentQuizProgress;
  /**
   * Sprint 07 — the stored summary of the last FINISHED attempt, or null when
   * there is none or an attempt is currently in flight.
   *
   * Non-null means "you have finished this before; here is what you scored".
   * Before this existed, QuizStage fetched `progress`, had nothing to render
   * from it, and reset every visit to a blank question 1 — so reopening a quiz
   * you had already passed silently threw the result away and started again.
   *
   * The server withholds it while an attempt is in flight: this body carries
   * correctAnswer for every question.
   */
  lastResult: SubmitQuizResponse | null;
}

export interface SubmitAnswerInput {
  questionId: string;
  submitted: SubmittedAnswer;
}

export interface SubmitQuizInput {
  clientAttemptId: string;
  // Optional as of Sprint 06B.5: under IMMEDIATE feedback every answer was
  // already graded and recorded server-side, and anything sent here is
  // ignored for scoring. Required only for ON_SUBMIT quizzes.
  answers?: SubmitAnswerInput[];
}

export interface AnswerQuestionInput {
  clientAttemptId: string;
  questionId: string;
  submitted: SubmittedAnswer;
}

// Response of the per-question grading call. Carries the correct answer
// because the student has just committed to their own — this is the moment
// the reveal is earned.
export interface AnswerQuestionResponse {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
  answeredCount: number;
  totalCount: number;
  // Counted server-side from the recorded run; the client never tallies
  // its own streak.
  currentStreak: number;
  allAnswered: boolean;
}

export interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  submitted: SubmittedAnswer | null;
  correctAnswer: unknown;
  explanation: string | null;
}

// The ONLY response in this file that ever carries a correctAnswer.
export interface SubmitQuizResponse {
  correctCount: number;
  totalCount: number;
  accuracyPercent: number;
  passed: boolean;
  passingScorePercent: number;
  attemptsCount: number;
  bestScorePercent: number;
  durationSeconds: number | null;
  results: QuestionResult[];
  // Sprint 10 — EPHEMERAL, and a sibling of the recorded result rather than
  // part of it. The server never stores this alongside the attempt, so a
  // replayed submit reports `xpAwarded: 0` instead of re-announcing an award
  // that already happened. Optional so a response from an older backend still
  // type-checks.
  gamification?: GamificationResult;
}

export interface CourseQuizProgressRow {
  lessonId: string;
  passed: boolean;
  bestScorePercent: number | null;
  attemptsCount: number;
}

export const QUIZ_IDEMPOTENCY_CONFLICT = 'QUIZ_IDEMPOTENCY_CONFLICT';
export const isQuizIdempotencyConflict = (error: unknown): boolean =>
  error instanceof ApiError && error.code === QUIZ_IDEMPOTENCY_CONFLICT;

// --- Student -----------------------------------------------------------------

// READ-ONLY as of Sprint 07. This used to start an attempt as a side effect,
// which meant merely opening a finished quiz began a new one behind the
// student's back. Starting is now POST /quiz/start, below.
export const getLessonQuiz = async (lessonId: string): Promise<GetQuizResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz`);
  if (!response.ok) return throwApiError(response, 'Failed to load quiz');
  return response.json();
};

// Sprint 07 — the explicit start, mirroring POST /practice/start.
//
// Idempotent server-side: an attempt already in flight is returned untouched,
// so a double-click or a mid-quiz refresh never restarts the clock or
// reshuffles a question the student is already looking at.
export const startLessonQuiz = async (lessonId: string): Promise<GetQuizResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz/start`, {
    method: 'POST',
  });
  if (!response.ok) return throwApiError(response, 'Failed to start quiz');
  return response.json();
};

// Sprint 06B.5 — grade ONE question. IMMEDIATE-mode quizzes only; an
// ON_SUBMIT quiz answers this with a 400, since per-question grading would
// reveal exactly what that mode withholds until the end.
export const answerQuizQuestion = async (
  lessonId: string,
  dto: AnswerQuestionInput,
): Promise<AnswerQuestionResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to check answer');
  return response.json();
};

export const submitLessonQuiz = async (
  lessonId: string,
  dto: SubmitQuizInput,
): Promise<SubmitQuizResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to submit quiz');
  // Sprint 10 — announce whatever this submit earned, so the level widget
  // updates wherever the student happens to be. A replay reports 0 and is
  // filtered inside the publisher. See gamificationService.
  const body: SubmitQuizResponse = await response.json();
  publishGamificationResult(body.gamification);
  return body;
};

export const getCourseQuizProgress = async (
  courseId: string,
): Promise<{ data: CourseQuizProgressRow[] }> => {
  const response = await apiFetch(`${API_BASE_URL}/courses/${courseId}/quiz-progress`);
  if (!response.ok) return throwApiError(response, 'Failed to load quiz progress');
  return response.json();
};

// --- Admin (ADMIN role required server-side) ---------------------------------

export interface ManageQuestion {
  id: string;
  type: QuestionType;
  difficulty: QuestionDifficulty | null;
  content: string;
  options: QuizQuestionOption[] | null;
  correctAnswer: unknown;
  explanation: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  orderIndex: number;
}

export interface ManageQuiz {
  taskId: string | null;
  isPublished: boolean;
  passingScorePercent: number | null;
  feedbackMode: QuizFeedbackMode;
  questionCount: number;
  questions: ManageQuestion[];
}

// id present = update that question; absent = create a new one. Any
// existing question whose id is not present in the array sent to
// upsertQuiz() is deleted server-side — this is a whole-document upsert,
// not a patch.
export interface UpsertQuestionInput {
  id?: string;
  type: QuestionType;
  content: string;
  difficulty?: QuestionDifficulty;
  options?: QuizQuestionOption[];
  correctAnswer: unknown;
  explanation?: string;
  audioUrl?: string;
  imageUrl?: string;
}

export interface UpsertQuizInput {
  passingScorePercent?: number;
  // Absent leaves an existing quiz's mode untouched (and lets a new one
  // take the server default), rather than silently resetting it.
  feedbackMode?: QuizFeedbackMode;
  questions: UpsertQuestionInput[];
}

export const getManageQuiz = async (lessonId: string): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz/manage`);
  if (!response.ok) return throwApiError(response, 'Failed to load quiz');
  return response.json();
};

export const upsertQuiz = async (lessonId: string, dto: UpsertQuizInput): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) return throwApiError(response, 'Failed to save quiz');
  return response.json();
};

export const publishQuiz = async (lessonId: string): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz/publish`, { method: 'PATCH' });
  if (!response.ok) return throwApiError(response, 'Failed to publish quiz');
  return response.json();
};

export const unpublishQuiz = async (lessonId: string): Promise<ManageQuiz> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz/unpublish`, { method: 'PATCH' });
  if (!response.ok) return throwApiError(response, 'Failed to unpublish quiz');
  return response.json();
};

export const deleteQuiz = async (lessonId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/lessons/${lessonId}/quiz`, { method: 'DELETE' });
  if (!response.ok) return throwApiError(response, 'Failed to delete quiz');
};
