import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

export interface ChatSession {
  turns: ChatTurn[];
  expiresAt: string | null;
}

export interface SendChatMessageResult {
  clientMessageId: string;
  reply: string;
  repliedAt: string;
}

// Mirrors the backend's LessonPage `?stage=` values exactly (chat-context.
// types.ts's LESSON_CONTEXT_STAGES) — descriptive only, never used for
// access control on either side.
export type LessonContextStage = 'video' | 'theory' | 'quiz' | 'traphunter' | 'practice';

// Phase C — mirrors chat-context.types.ts's ChatContextInput. The server
// re-resolves and re-authorizes resourceId from scratch either way
// (ChatContextResolver); this is just the wire shape.
export type ChatContextInput =
  | { type: 'GENERAL' }
  | { type: 'LESSON'; resourceId: string; stage?: LessonContextStage }
  | { type: 'VOCAB_WORD'; resourceId: string };

// POST /chat/messages — clientMessageId is generated ONCE per logical
// outgoing message by the caller (ChatPanel) and reused verbatim on retry,
// never regenerated here. The server owns conversation history; this
// request never carries a transcript, only the new message.
//
// No AbortSignal — same reasoning as dictionaryService.ts's lookupWord:
// apiFetch -> fetchWithTimeout always builds its OWN AbortController and
// ignores a caller-supplied one.
export const sendChatMessage = async (
  clientMessageId: string,
  message: string,
  context: ChatContextInput = { type: 'GENERAL' },
): Promise<SendChatMessageResult> => {
  const response = await apiFetch(`${API_BASE_URL}/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientMessageId, message, context }),
  });

  if (!response.ok) return throwApiError(response, 'Failed to send message to Engy');
  return response.json();
};

// GET /chat/session — restores the bounded Redis history (if the TTL has
// not expired). Always 200; an expired/never-started session is
// `{turns: [], expiresAt: null}`, not an error.
export const getChatSession = async (): Promise<ChatSession> => {
  const response = await apiFetch(`${API_BASE_URL}/chat/session`);

  if (!response.ok) return throwApiError(response, 'Failed to load chat session');
  return response.json();
};

// DELETE /chat/session — idempotent; clearing an already-empty session is
// still a 204.
export const clearChatSession = async (): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/chat/session`, { method: 'DELETE' });

  if (!response.ok) await throwApiError(response, 'Failed to clear chat session');
};
