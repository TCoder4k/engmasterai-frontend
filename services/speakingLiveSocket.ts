// Speaking Partner Live — the thin WebSocket client for /speaking/live.
//
// AUTHENTICATED BY A ONE-SHOT TICKET, NOT THE ACCESS JWT. The ticket comes
// from `startSpeakingAttempt()`'s response (`liveTicket`) — see
// speaking-live-ticket.store.ts's backend header for why a query-string
// JWT was rejected during review. This module never touches the access
// token at all.
//
// A THIN RELAY, ON PURPOSE. All correctness (transcript accumulation,
// exactly-once finalization) lives server-side in SpeakingLiveSession —
// this file's only job is turning typed calls into JSON frames and typed
// events back out of them.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const liveWsUrl = (ticket: string): string => {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/speaking/live?ticket=${encodeURIComponent(ticket)}`;
};

export interface SpeakingLiveSocketHandlers {
  onAudioChunk: (base64Pcm16: string) => void;
  /** The cued opening line finished streaming — Gemini's own voice spoke it, not browser TTS. No transcript, not a turn; the caller's next job is to cache its buffered audio for replay. */
  onOpeningReady: () => void;
  onTurnFinalized: (userText: string, aiText: string) => void;
  /** The turn produced no usable transcript on one or both sides — nothing was persisted. */
  onTurnEmpty: () => void;
  /** A Gemini-side failure mid-turn. The mic should re-enable so the student can just try again. */
  onTurnError: () => void;
  onInterrupted: () => void;
  /** The whole Live connection ended — this is an MVP, not a resumable session (see docs/CLAUDE.md). */
  onSessionClosed: (reason: string) => void;
  /** The socket never opened, or closed before any session-level event explained why. */
  onConnectionLost: () => void;
}

export interface SpeakingLiveSocketConnection {
  /** Send once capture genuinely begins — see useSpeakingLiveCapture's onRecordingStart. */
  startTurn: () => void;
  sendAudioChunk: (base64Pcm16: string) => void;
  /** Send once capture genuinely ends — see useSpeakingLiveCapture's onRecordingStop. */
  endTurn: () => void;
  close: () => void;
}

interface ServerEvent {
  type: 'audioChunk' | 'openingReady' | 'turnFinalized' | 'turnEmpty' | 'turnError' | 'interrupted' | 'sessionClosed';
  data?: string;
  userText?: string;
  aiText?: string;
  reason?: string;
}

/**
 * Opens one Live connection. Fire-and-forget from the caller's side once
 * opened — events arrive through `handlers` as they happen. Sending before
 * the socket is actually open is safe: `send()` calls made in that window
 * are simply held by the browser's own WebSocket buffering (bufferedAmount)
 * until OPEN, so no separate outbound queue is needed here.
 */
export const connectSpeakingLive = (
  ticket: string,
  handlers: SpeakingLiveSocketHandlers,
): SpeakingLiveSocketConnection => {
  const socket = new WebSocket(liveWsUrl(ticket));
  let closedExplicitly = false;
  let sawSessionEvent = false;

  const send = (payload: Record<string, unknown>) => {
    if (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING) return;
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      // A send failing here means the socket is already going away — the
      // 'close' handler below is what actually reports that to the caller.
    }
  };

  socket.onmessage = (event: MessageEvent<string>) => {
    let parsed: ServerEvent;
    try {
      parsed = JSON.parse(event.data) as ServerEvent;
    } catch {
      return;
    }
    switch (parsed.type) {
      case 'audioChunk':
        if (typeof parsed.data === 'string') handlers.onAudioChunk(parsed.data);
        break;
      case 'openingReady':
        handlers.onOpeningReady();
        break;
      case 'turnFinalized':
        if (typeof parsed.userText === 'string' && typeof parsed.aiText === 'string') {
          handlers.onTurnFinalized(parsed.userText, parsed.aiText);
        }
        break;
      case 'turnEmpty':
        handlers.onTurnEmpty();
        break;
      case 'turnError':
        handlers.onTurnError();
        break;
      case 'interrupted':
        handlers.onInterrupted();
        break;
      case 'sessionClosed':
        sawSessionEvent = true;
        handlers.onSessionClosed(parsed.reason ?? 'unknown');
        break;
    }
  };

  socket.onclose = () => {
    if (closedExplicitly || sawSessionEvent) return;
    // The connection ended without the server ever explaining why (a
    // rejected handshake — missing/expired ticket, rate limit, an
    // unpublished exercise — or a raw network drop). Distinct from
    // `onSessionClosed`: that one means a session actually started and then
    // ended; this means the student never really got one.
    handlers.onConnectionLost();
  };

  return {
    startTurn: () => send({ type: 'activityStart' }),
    sendAudioChunk: (base64Pcm16: string) => send({ type: 'audioChunk', data: base64Pcm16 }),
    endTurn: () => send({ type: 'activityEnd' }),
    close: () => {
      closedExplicitly = true;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    },
  };
};
