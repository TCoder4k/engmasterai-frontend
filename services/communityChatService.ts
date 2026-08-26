import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface CommunityMessageAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  level: number;
}

export interface CommunityMessage {
  id: string;
  content: string;
  clientMessageId: string;
  createdAt: string;
  author: CommunityMessageAuthor;
}

export interface ListCommunityMessagesResult {
  data: CommunityMessage[];
  meta: {
    hasMore: boolean;
    oldestId: string | null;
  };
}

// GET /community/messages — cursor pagination (`before` = a message id, not
// a page number): a live-appending feed has no stable "page N". No
// `before` returns the most recent page; otherwise the next page strictly
// older than `before`. Always oldest→newest, so the caller can prepend
// without re-sorting on either the initial load or a later "load older".
export const listCommunityMessages = async (
  before?: string,
  limit?: number,
): Promise<ListCommunityMessagesResult> => {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();

  const response = await apiFetch(`${API_BASE_URL}/community/messages${query ? `?${query}` : ''}`);

  if (!response.ok) return throwApiError(response, 'Failed to load community messages');
  return response.json();
};

// POST /community/messages — clientMessageId is generated ONCE per logical
// outgoing message by the caller and reused verbatim on retry, never
// regenerated here, same convention as chatService's sendChatMessage.
// Identity (the author) is derived server-side from the authenticated
// request; this body never carries one.
export const sendCommunityMessage = async (
  clientMessageId: string,
  content: string,
): Promise<CommunityMessage> => {
  const response = await apiFetch(`${API_BASE_URL}/community/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientMessageId, content }),
  });

  if (!response.ok) return throwApiError(response, 'Failed to send message');
  return response.json();
};

// GET /community/messages/unread-count — mirrors notificationService.ts's
// getUnreadNotificationCount shape exactly. Backend excludes the caller's
// own messages and lazily starts a brand-new user's cursor at "now" (see
// docs/CLAUDE.md), so this never charges anyone for pre-existing history.
export const getUnreadCommunityMessageCount = async (): Promise<number> => {
  const response = await apiFetch(`${API_BASE_URL}/community/messages/unread-count`);
  if (!response.ok) return throwApiError(response, 'Failed to load unread message count');
  const body = await response.json();
  return body.count;
};

// POST /community/messages/read — advances the caller's read cursor to now.
// "Read" here means "everything before this moment", not a per-message
// receipt — the right granularity for a global room, not a DM.
export const markCommunityMessagesRead = async (): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/community/messages/read`, { method: 'POST' });
  if (!response.ok) return throwApiError(response, 'Failed to mark messages read');
};

// POST /community/live-ticket — issues a short-lived, single-use ticket for
// the /community/live WebSocket handshake (see communityChatSocket.ts).
// Requested fresh before every connection attempt, including reconnects —
// a ticket is single-use and expires in 45s, so one is never reused.
export const issueCommunityLiveTicket = async (): Promise<{ ticket: string }> => {
  const response = await apiFetch(`${API_BASE_URL}/community/live-ticket`, { method: 'POST' });

  if (!response.ok) return throwApiError(response, 'Failed to connect to Community Chat');
  return response.json();
};
