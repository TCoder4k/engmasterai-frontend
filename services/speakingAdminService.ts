import { CefrLevel } from '../types';
import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ManagedSpeakingScenario {
  id: string;
  name: string;
  nameVi: string;
  description: string | null;
  descriptionVi: string | null;
  level: CefrLevel | null;
  orderIndex: number;
  isPublished: boolean;
  isFreeTalk: boolean;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedSpeakingExercise {
  id: string;
  scenarioId: string;
  title: string;
  titleVi: string;
  description: string;
  descriptionVi: string;
  level: CefrLevel;
  aiRole: string;
  aiRoleVi: string;
  conversationGoal: string;
  conversationGoalVi: string;
  targetTurns: number;
  openingLine: string;
  openingLineVi: string;
  orderIndex: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakingScenarioPayload {
  name: string;
  nameVi: string;
  description?: string;
  descriptionVi?: string;
  level?: CefrLevel;
  orderIndex?: number;
  isFreeTalk?: boolean;
}

export type UpdateSpeakingScenarioPayload = Partial<CreateSpeakingScenarioPayload>;

export interface CreateSpeakingExercisePayload {
  scenarioId: string;
  title: string;
  titleVi: string;
  description: string;
  descriptionVi: string;
  level: CefrLevel;
  aiRole: string;
  aiRoleVi: string;
  conversationGoal: string;
  conversationGoalVi: string;
  targetTurns?: number;
  openingLine: string;
  openingLineVi: string;
  orderIndex?: number;
}

export type UpdateSpeakingExercisePayload = Partial<CreateSpeakingExercisePayload>;

const jsonHeaders = { 'Content-Type': 'application/json' };

// --- Scenarios ---------------------------------------------------------------

export const getManagedSpeakingScenarios = async (): Promise<ManagedSpeakingScenario[]> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/scenarios`);
  if (!response.ok) return throwApiError(response, 'Không tải được danh sách kịch bản Speaking');
  return response.json();
};

export const createSpeakingScenario = async (
  payload: CreateSpeakingScenarioPayload,
): Promise<ManagedSpeakingScenario> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/scenarios`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không tạo được kịch bản Speaking');
  return response.json();
};

export const updateSpeakingScenario = async (
  id: string,
  payload: UpdateSpeakingScenarioPayload,
): Promise<ManagedSpeakingScenario> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/scenarios/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không cập nhật được kịch bản Speaking');
  return response.json();
};

export const publishSpeakingScenario = async (id: string): Promise<ManagedSpeakingScenario> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/scenarios/${id}/publish`, {
    method: 'PATCH',
  });
  if (!response.ok) return throwApiError(response, 'Không xuất bản được kịch bản');
  return response.json();
};

export const unpublishSpeakingScenario = async (id: string): Promise<ManagedSpeakingScenario> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/scenarios/${id}/unpublish`, {
    method: 'PATCH',
  });
  if (!response.ok) return throwApiError(response, 'Không gỡ xuất bản được kịch bản');
  return response.json();
};

export const deleteSpeakingScenario = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/scenarios/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) return throwApiError(response, 'Không xóa được kịch bản');
};

// --- Exercises ---------------------------------------------------------------

export const getManagedSpeakingExercises = async (
  scenarioId?: string,
): Promise<ManagedSpeakingExercise[]> => {
  const query = scenarioId ? `?scenarioId=${scenarioId}` : '';
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/exercises${query}`);
  if (!response.ok) return throwApiError(response, 'Không tải được danh sách bài tập Speaking');
  const json = await response.json();
  return Array.isArray(json) ? json : json.data || [];
};

export const createSpeakingExercise = async (
  payload: CreateSpeakingExercisePayload,
): Promise<ManagedSpeakingExercise> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/exercises`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không tạo được bài tập Speaking');
  return response.json();
};

export const updateSpeakingExercise = async (
  id: string,
  payload: UpdateSpeakingExercisePayload,
): Promise<ManagedSpeakingExercise> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/exercises/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không cập nhật được bài tập');
  return response.json();
};

export const publishSpeakingExercise = async (id: string): Promise<ManagedSpeakingExercise> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/exercises/${id}/publish`, {
    method: 'PATCH',
  });
  if (!response.ok) return throwApiError(response, 'Không xuất bản được bài tập');
  return response.json();
};

export const unpublishSpeakingExercise = async (id: string): Promise<ManagedSpeakingExercise> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/exercises/${id}/unpublish`, {
    method: 'PATCH',
  });
  if (!response.ok) return throwApiError(response, 'Không gỡ xuất bản được bài tập');
  return response.json();
};

export const deleteSpeakingExercise = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/manage/exercises/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) return throwApiError(response, 'Không xóa được bài tập');
};
