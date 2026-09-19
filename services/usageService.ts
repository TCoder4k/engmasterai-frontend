import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 2026-09-16 pricing relaunch (Phase B). Mirrors the backend's
// UsageQuotaStatus shape exactly (src/usage/usage-quota.types.ts).
export type UsageKind = 'aiQuery' | 'aiGrading' | 'speaking';
export type UsagePeriod = 'month' | 'day';

export interface UsageQuotaStatus {
  kind: UsageKind;
  used: number;
  limit: number;
  period: UsagePeriod;
  periodKey: string;
}

// GET /usage/quota — read-only, never increments. Powers the "AI 17/20"
// style widget; the actual quota-consuming calls happen inside
// Dictionary/Chat/Shadowing/Speaking's own endpoints.
export const getUsageQuota = async (): Promise<UsageQuotaStatus[]> => {
  const response = await apiFetch(`${API_BASE_URL}/usage/quota`);
  if (!response.ok) return throwApiError(response, 'Failed to load usage quota');
  return response.json();
};
