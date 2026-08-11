import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import { CourseType } from '../types';
import { QuestionType, QuestionDifficulty, QuizQuestionOption } from './quizService';

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
