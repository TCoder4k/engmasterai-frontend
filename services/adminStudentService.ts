import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import { LearningGoal } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 15 (Admin student management). Mirrors the backend response shapes
// in admin-student-overview.types.ts exactly — see that file for why
// progressPercent/averageTestScore are defined the way they are (reused
// existing product definitions, not invented metrics).

export interface AdminStudentListRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  level: number;
  learningGoal: LearningGoal | null;
  progressPercent: number | null;
  completedLessons: number;
  totalLessons: number;
  averageTestScore: number | null;
  completedTestCount: number;
  isPro: boolean;
  proExpiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminStudentListResponse {
  data: AdminStudentListRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AdminStudentRecentTest {
  taskTitle: string;
  lessonTitle: string;
  accuracyPercent: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  submittedAt: string;
}

export type AdminStudentPaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';

export interface AdminStudentPaymentRow {
  paymentCode: string;
  amount: number;
  currency: string;
  status: AdminStudentPaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminStudentDetail {
  profile: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    level: number;
    learningGoal: LearningGoal | null;
    createdAt: string;
    isActive: boolean;
    isPro: boolean;
    proExpiresAt: string | null;
  };
  progress: {
    progressPercent: number | null;
    completedLessons: number;
    totalLessons: number;
    hasRoadmap: boolean;
    averageTestScore: number | null;
    completedTestCount: number;
    recentTests: AdminStudentRecentTest[];
  };
  activity: {
    totalStudySeconds: number;
    currentStreakDays: number;
    speakingSessionsTotal: number;
    speakingSessionsCompleted: number;
  };
  billing: {
    plan: 'PRO_MONTHLY' | null;
    isPro: boolean;
    proExpiresAt: string | null;
    payments: AdminStudentPaymentRow[];
    paymentsTotal: number;
  };
}

// GET /users/overview — paginated summary for the admin student table.
export const getStudentOverview = async (
  page?: number,
  limit?: number,
  search?: string,
  plan?: 'FREE' | 'PRO',
  status?: 'ACTIVE' | 'BLOCKED',
): Promise<AdminStudentListResponse> => {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (search) params.set('search', search);
  if (plan) params.set('plan', plan);
  if (status) params.set('status', status);

  const query = params.toString();
  const response = await apiFetch(`${API_BASE_URL}/users/overview${query ? `?${query}` : ''}`);

  if (!response.ok) return throwApiError(response, 'Failed to load student overview');
  return response.json();
};

// GET /users/:id/overview — full admin student detail page.
export const getStudentDetail = async (id: string): Promise<AdminStudentDetail> => {
  const response = await apiFetch(`${API_BASE_URL}/users/${id}/overview`);

  if (!response.ok) return throwApiError(response, 'Failed to load student detail');
  return response.json();
};

// PATCH /users/:id/status — block/unblock. 403 if the admin targets their
// own account with isActive:false (server-enforced; see UserController).
export const setStudentActiveStatus = async (
  id: string,
  isActive: boolean,
): Promise<{ id: string; isActive: boolean }> => {
  const response = await apiFetch(`${API_BASE_URL}/users/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update student status');
  return response.json();
};
