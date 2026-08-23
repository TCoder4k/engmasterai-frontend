import { useEffect, useRef, useState } from 'react';
import { connectCommunityLive } from '../../../../services/communityChatSocket';
import type { CommunityChatSocketConnection } from '../../../../services/communityChatSocket';
import { issueCommunityLiveTicket, type CommunityMessage } from '../../../../services/communityChatService';

export type CommunityConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'disconnected';

// Reconnect-with-backoff — new ground for this codebase. speakingLiveSocket's
// own header comment explicitly has none of this ("an MVP, not a resumable
// session"); Community Chat is a persistent public room students expect to
// stay live in the background while they use the Engy tab, so staying
// connected is worth the extra complexity a one-off Speaking session
// doesn't need. A fresh ticket is fetched on every attempt, including
// retries — tickets are single-use with a 45s TTL, so reusing one is never
// valid.
const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 16000];

export const useCommunityChatSocket = (
  enabled: boolean,
  onMessage: (message: CommunityMessage) => void,
): { status: CommunityConnectionStatus; retryNow: () => void } => {
  const [status, setStatus] = useState<CommunityConnectionStatus>('idle');
  const [retryTick, setRetryTick] = useState(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let attempt = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let connection: CommunityChatSocketConnection | null = null;

    const scheduleRetry = () => {
      if (attempt >= BACKOFF_STEPS_MS.length) {
        setStatus('disconnected');
        return;
      }
      const delay = BACKOFF_STEPS_MS[attempt];
      attempt += 1;
      setStatus('reconnecting');
      timeoutId = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      setStatus((prev) => (prev === 'idle' ? 'connecting' : 'reconnecting'));
      let ticket: string;
      try {
        ({ ticket } = await issueCommunityLiveTicket());
      } catch {
        if (!cancelled) scheduleRetry();
        return;
      }
      if (cancelled) return;

      connection = connectCommunityLive(ticket, {
        onConnected: () => {
          if (cancelled) return;
          attempt = 0;
          setStatus('open');
        },
        onMessage: (message) => onMessageRef.current(message),
        onConnectionLost: () => {
          connection = null;
          if (!cancelled) scheduleRetry();
        },
      });
    };

    void connect();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      connection?.close();
    };
  }, [enabled, retryTick]);

  return { status, retryNow: () => setRetryTick((tick) => tick + 1) };
};
