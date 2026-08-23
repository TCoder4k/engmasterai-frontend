import type { CommunityMessage } from './communityChatService';

// Community Chat Live — the thin WebSocket client for /community/live.
// Mirrors speakingLiveSocket.ts's shape: a one-shot connection function,
// authenticated by a one-shot ticket (never the access JWT — see the
// backend's community-chat-ticket.store.ts for why), typed handlers turning
// JSON frames into typed callbacks. There is no outbound frame at all —
// sending a message is REST-only (communityChatService.sendCommunityMessage)
// — this socket only ever receives.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const liveWsUrl = (ticket: string): string => {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/community/live?ticket=${encodeURIComponent(ticket)}`;
};

export interface CommunityChatSocketHandlers {
  /** The handshake passed the ticket + rate-limit checks — distinct from the transport-level `open` event, which fires before those async checks even resolve. */
  onConnected: () => void;
  onMessage: (message: CommunityMessage) => void;
  /** The socket closed without an explicit close() call from this side — see useCommunityChatSocket.ts for reconnect handling. */
  onConnectionLost: () => void;
}

export interface CommunityChatSocketConnection {
  close: () => void;
}

interface ServerEvent {
  type: 'connected' | 'community:message:new';
  message?: CommunityMessage;
}

export const connectCommunityLive = (
  ticket: string,
  handlers: CommunityChatSocketHandlers,
): CommunityChatSocketConnection => {
  const socket = new WebSocket(liveWsUrl(ticket));
  let closedExplicitly = false;

  socket.onmessage = (event: MessageEvent<string>) => {
    let parsed: ServerEvent;
    try {
      parsed = JSON.parse(event.data) as ServerEvent;
    } catch {
      return;
    }
    switch (parsed.type) {
      case 'connected':
        handlers.onConnected();
        break;
      case 'community:message:new':
        if (parsed.message) handlers.onMessage(parsed.message);
        break;
    }
  };

  socket.onclose = () => {
    if (closedExplicitly) return;
    handlers.onConnectionLost();
  };

  return {
    close: () => {
      closedExplicitly = true;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    },
  };
};
