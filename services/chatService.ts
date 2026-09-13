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
// 2026-09-12 — streaming rewrite. The reply now arrives as SSE (delta
// events, then one done event) instead of a single JSON body — see
// chat.controller.ts. No AbortSignal on the underlying apiFetch call, same
// reasoning as dictionaryService.ts's lookupWord: apiFetch -> fetchWithTimeout
// always builds its OWN AbortController and ignores a caller-supplied one —
// this is safe here because that timeout only bounds the wait for response
// HEADERS (resolved as soon as the server commits to streaming), not the
// body read that follows.
export interface SendChatMessageStreamHandlers {
  /** Fires once per streamed text fragment, in order — already clipped to the server's reply-length cap. */
  onDelta: (text: string) => void;
  /** Fires exactly once, on success — the same shape the old one-shot sendChatMessage used to resolve with. */
  onDone: (result: SendChatMessageResult) => void;
}

// One SSE frame: an `event:` line, one or more `data:` lines, terminated by
// a blank line. Buffers across multiple `reader.read()` calls and yields
// only COMPLETE frames — mirrors the backend's shared/sse-frame-reader.ts
// buffering algorithm exactly (same reasoning: a frame can arrive split
// across two network reads, or several frames can land in one read, and a
// naive per-read `chunk.split('\n\n')` silently mangles either case). Not
// implemented as a shared package (this is a separate repo from the
// backend) — kept as one small, directly-testable class instead.
class SseFrameBuffer {
  private buffer = '';

  push(chunk: string): { event: string; data: string }[] {
    this.buffer += chunk;
    const frames: { event: string; data: string }[] = [];
    for (;;) {
      const boundary = this.findBoundary();
      if (!boundary) break;
      const raw = this.buffer.slice(0, boundary.start);
      this.buffer = this.buffer.slice(boundary.end);
      const frame = parseFrame(raw);
      if (frame) frames.push(frame);
    }
    return frames;
  }

  private findBoundary(): { start: number; end: number } | null {
    const lf = this.buffer.indexOf('\n\n');
    const crlf = this.buffer.indexOf('\r\n\r\n');
    if (lf === -1 && crlf === -1) return null;
    if (crlf !== -1 && (lf === -1 || crlf < lf)) return { start: crlf, end: crlf + 4 };
    return { start: lf, end: lf + 2 };
  }
}

const parseFrame = (raw: string): { event: string; data: string } | null => {
  let event = '';
  const dataLines: string[] = [];
  for (const line of raw.split(/\r\n|\n/)) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trimStart());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
};

export const sendChatMessageStream = async (
  clientMessageId: string,
  message: string,
  context: ChatContextInput,
  handlers: SendChatMessageStreamHandlers,
): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientMessageId, message, context }),
  });

  // Every failure that can happen BEFORE the server commits to streaming
  // (400/403/404/409/429 — a bad context, the assessment lock, a concurrent
  // duplicate, rate limiting) is still a normal JSON error response, exactly
  // as before — see chat.controller.ts's own comment on why.
  if (!response.ok) return throwApiError(response, 'Failed to send message to Engy');
  if (!response.body) throw new Error('Engy chat stream had no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const sse = new SseFrameBuffer();
  // 2026-09-13 real production report: a user watched Engy's reply grow for
  // a while, then just stop mid-sentence — no error, no retry button, stuck
  // forever. Root cause: this loop used to `return` as soon as
  // `reader.read()` reported `done: true`, treating that as a normal end of
  // stream unconditionally. But OUR OWN backend always closes the
  // connection with a `done` or `error` SSE frame already written first
  // (chat.controller.ts) — the only way `reader.read()` can report `done`
  // BEFORE either of those frames arrived is the connection being cut from
  // outside our own code (a reverse proxy/CDN idle-timeout in production,
  // a network drop, the backend process restarting mid-reply). Silently
  // returning left `pending` stuck in 'sending' forever with a half-grown
  // reply, since neither `onDone` nor a thrown error ever followed. Now any
  // stream end that never saw a terminal event throws, which routes through
  // the exact same catch-and-show-retry path EngyChatView.tsx already has
  // for every other failure — mirrors the identical fix just made on the
  // backend's own Gemini-stream reader (gemini-engy-chat.provider.ts's
  // `finishReason !== 'STOP'` check) for the same class of silent cutoff.
  let sawTerminalEvent = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      if (!sawTerminalEvent) {
        throw new Error('Engy chat stream ended unexpectedly before finishing');
      }
      return;
    }
    for (const frame of sse.push(decoder.decode(value, { stream: true }))) {
      if (frame.event === 'delta') {
        handlers.onDelta((JSON.parse(frame.data) as { text: string }).text);
      } else if (frame.event === 'done') {
        sawTerminalEvent = true;
        handlers.onDone(JSON.parse(frame.data) as SendChatMessageResult);
        await reader.cancel();
        return;
      } else if (frame.event === 'error') {
        sawTerminalEvent = true;
        await reader.cancel();
        throw new Error((JSON.parse(frame.data) as { message?: string }).message ?? 'Engy is unavailable');
      }
    }
  }
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
