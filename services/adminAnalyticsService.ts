import { apiFetch } from './apiFetch';
import { throwApiError } from './apiError';

// Mirrors the backend response exactly (see
// engmasterai-backend/src/analytics/dto/admin-dashboard-analytics.types.ts).
// No field is added here that the backend does not send — a number this app
// cannot honestly compute is `null` on the wire, and stays `null` here rather
// than being defaulted to 0 by a type that pretends it can't be missing.

export interface AdminSummary {
  totalStudents: number;
  totalCourses: number;
  dauAvg7d: number;
  dauAvg7dChangePercent: number | null;
  passRatePercent: number | null;
  passRatePercentChangePercent: number | null;
  aiSessions7d: number;
  aiSessions7dChangePercent: number | null;
  aiTurns7d: number;
  aiTurns7dChangePercent: number | null;
}

export interface AdminEngagementPoint {
  date: string;
  activeUsers: number;
  completedActivities: number;
}

export interface AdminUserGrowthDailyPoint {
  date: string;
  totalStudents: number;
}

export interface AdminUserGrowth {
  totalStudents: number;
  newLast30d: number;
  /** Always null today — no lastLoginAt/deletedAt signal exists yet. */
  decreasedLast30d: null;
  retentionRatePercent: null;
  dailyCumulative: AdminUserGrowthDailyPoint[];
}

export type AdminSkillType = 'LISTENING' | 'SPEAKING' | 'VOCAB_GRAMMAR';

export interface AdminSkillBreakdown {
  type: AdminSkillType;
  sessionCount: number;
}

export interface AdminTopStudent {
  id: string;
  name: string;
  email: string;
  level: number;
  totalStudySeconds: number;
  completedTasks: number;
}

export interface AdminDashboardAnalytics {
  summary: AdminSummary;
  engagement: AdminEngagementPoint[];
  userGrowth: AdminUserGrowth;
  skills: AdminSkillBreakdown[];
  topStudents: AdminTopStudent[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const getAdminDashboardAnalytics = async (): Promise<AdminDashboardAnalytics> => {
  const response = await apiFetch(`${API_BASE_URL}/analytics/admin-dashboard`);

  if (!response.ok) return throwApiError(response, 'Failed to load admin analytics');
  return response.json();
};
