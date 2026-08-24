import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type NotificationType =
  | 'STREAK_INVITATION_RECEIVED'
  | 'STREAK_INVITATION_ACCEPTED'
  | 'STREAK_MILESTONE'
  | 'STREAK_BROKEN'
  | 'STREAK_PARTNER_ACTIVE';

export interface NotificationPayload {
  partnerId?: string;
  partnerName?: string;
  partnerAvatarUrl?: string | null;
  invitationId?: string;
  streakId?: string;
  days?: number;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  payload: NotificationPayload;
  read: boolean;
  createdAt: string;
}

export interface ListNotificationsResult {
  data: AppNotification[];
  meta: { hasMore: boolean; oldestId: string | null };
}

export const listNotifications = async (before?: string, limit?: number): Promise<ListNotificationsResult> => {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  const response = await apiFetch(`${API_BASE_URL}/notifications${query ? `?${query}` : ''}`);
  if (!response.ok) return throwApiError(response, 'Failed to load notifications');
  return response.json();
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const response = await apiFetch(`${API_BASE_URL}/notifications/unread-count`);
  if (!response.ok) return throwApiError(response, 'Failed to load unread notification count');
  const body = await response.json();
  return body.count;
};

export const markNotificationRead = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to mark notification read');
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/notifications/read-all`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to mark notifications read');
};
