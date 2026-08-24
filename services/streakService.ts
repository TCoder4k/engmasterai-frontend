import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface StreakPartner {
  id: string;
  name: string;
  avatarUrl: string | null;
  level: number;
}

export type StreakPairStatus = 'ACTIVE' | 'BROKEN';

export interface StreakPair {
  id: string;
  partner: StreakPartner;
  status: StreakPairStatus;
  currentStreak: number;
  longestStreak: number;
  startedAt: string;
  publicShareId: string | null;
}

export interface StreakDayStatus {
  day: string;
  meQualified: boolean;
  partnerQualified: boolean;
}

export interface StreakActivityToday {
  qualified: boolean;
  label: 'lesson' | 'practice' | 'vocab' | null;
  at: string | null;
}

export interface StreakDetail extends StreakPair {
  calendar: StreakDayStatus[];
  isAtRiskToday: boolean;
  meActivityToday: StreakActivityToday;
  partnerActivityToday: StreakActivityToday;
  percentileRank: number | null;
}

export type StreakInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';

export interface StreakInvitation {
  id: string;
  direction: 'sent' | 'received';
  counterpart: StreakPartner;
  status: StreakInvitationStatus;
  createdAt: string;
  expiresAt: string;
}

export type PairRelationship = 'none' | 'pending_sent' | 'pending_received' | 'active' | 'broken';

export interface PairRelationshipResult {
  relationship: PairRelationship;
  streak?: StreakPair;
  invitation?: StreakInvitation;
}

export interface PublicStreak {
  currentStreak: number;
  status: StreakPairStatus;
  startedAt: string;
  userA: { name: string; avatarUrl: string | null };
  userB: { name: string; avatarUrl: string | null };
}

export const sendStreakInvitation = async (inviteeId: string): Promise<StreakInvitation> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteeId }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to send streak invitation');
  return response.json();
};

export const listStreakInvitations = async (
  direction?: 'sent' | 'received',
  status?: StreakInvitationStatus,
): Promise<StreakInvitation[]> => {
  const params = new URLSearchParams();
  if (direction) params.set('direction', direction);
  if (status) params.set('status', status);
  const query = params.toString();
  const response = await apiFetch(`${API_BASE_URL}/streaks/invitations${query ? `?${query}` : ''}`);
  if (!response.ok) return throwApiError(response, 'Failed to load streak invitations');
  return response.json();
};

export const acceptStreakInvitation = async (invitationId: string): Promise<StreakPair> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks/invitations/${invitationId}/accept`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to accept streak invitation');
  return response.json();
};

export const declineStreakInvitation = async (invitationId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks/invitations/${invitationId}/decline`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to decline streak invitation');
};

export const cancelStreakInvitation = async (invitationId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks/invitations/${invitationId}/cancel`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to cancel streak invitation');
};

export const listMyStreaks = async (): Promise<StreakPair[]> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks`);
  if (!response.ok) return throwApiError(response, 'Failed to load streaks');
  return response.json();
};

// "What's my relationship with this user?" — powers the Community Chat
// entry point popover.
export const getStreakPairStatus = async (userId: string): Promise<PairRelationshipResult> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks/pair/${userId}`);
  if (!response.ok) return throwApiError(response, 'Failed to load streak status');
  return response.json();
};

export const getStreakDetail = async (streakId: string): Promise<StreakDetail> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks/${streakId}`);
  if (!response.ok) return throwApiError(response, 'Failed to load streak');
  return response.json();
};

export const generateStreakShareLink = async (streakId: string): Promise<{ shareId: string }> => {
  const response = await apiFetch(`${API_BASE_URL}/streaks/${streakId}/share`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to generate share link');
  return response.json();
};

// PUBLIC — unauthenticated, called from PublicStreakPage. Uses plain fetch
// (not apiFetch) deliberately: apiFetch attaches an Authorization header and
// tries a silent token refresh on 401, neither of which makes sense for a
// route a logged-out visitor is meant to load.
export const getPublicStreak = async (shareId: string): Promise<PublicStreak> => {
  const response = await fetch(`${API_BASE_URL}/streaks/public/${shareId}`);
  if (!response.ok) return throwApiError(response, 'Streak not found');
  return response.json();
};
