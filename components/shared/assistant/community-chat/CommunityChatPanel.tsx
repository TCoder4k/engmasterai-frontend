import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { authService } from '../../../../services/authService';
import { ApiError } from '../../../../services/apiError';
import { newUuidV4 } from '../../../../services/clientSessionId';
import {
  listCommunityMessages,
  sendCommunityMessage,
  type CommunityMessage,
} from '../../../../services/communityChatService';
import EmptyState from '../../EmptyState';
import ErrorState from '../../ErrorState';
import Skeleton from '../../Skeleton';
import CommunityFilterBar, { type CommunityFilterChip } from './CommunityFilterBar';
import CommunityMessageBubble from './CommunityMessageBubble';
import CommunityComposer from './CommunityComposer';
import { useCommunityChatSocket } from './useCommunityChatSocket';

const MAX_COMMUNITY_MESSAGE_LENGTH = 500; // mirrors SendCommunityMessageDto's backend limit

type LoadState = 'loading' | 'ready' | 'error';

type PendingSend = {
  clientMessageId: string;
  content: string;
  status: 'sending' | 'failed';
  error?: string;
};

interface CommunityChatPanelProps {
  /** Whether the Community tab is the currently visible one (see ChatPanel.tsx). */
  active: boolean;
}

// Community Chat ("Tán gẫu") — a separate domain from Engy AI end to end
// (User -> Backend -> Postgres -> WebSocket -> Users, never User -> Gemini),
// sharing only the outer panel/launcher chrome (see ChatPanel.tsx). This
// component owns its own data/session state entirely; nothing here reuses
// EngyChatView's history, composer state, or service calls.
const CommunityChatPanel: React.FC<CommunityChatPanelProps> = ({ active }) => {
  const { t } = useTranslation();
  const currentUserId = authService.getUser()?.id ?? null;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [pending, setPending] = useState<PendingSend | null>(null);
  // Lazily activated the first time this tab is actually shown, not on
  // mount — CommunityChatPanel mounts the instant the whole assistant panel
  // opens (see ChatPanel.tsx's "mount both, hide via CSS" design), so a
  // student who only ever uses Engy AI should never pay for a fetch, a
  // live-connect ticket, or a WebSocket connection they never asked for.
  // Once activated it stays activated for the life of the panel being
  // open — switching back to Engy does not tear the connection down, so
  // messages keep arriving live in the background.
  const [activated, setActivated] = useState(active);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);

  useEffect(() => {
    if (active) setActivated(true);
  }, [active]);

  const loadMessages = useCallback(() => {
    setLoadState('loading');
    listCommunityMessages()
      .then((result) => {
        setMessages(result.data);
        setHasMore(result.meta.hasMore);
        setLoadState('ready');
        shouldScrollRef.current = true;
      })
      .catch(() => {
        setLoadState('error');
      });
  }, []);

  useEffect(() => {
    if (!activated) return;
    loadMessages();
  }, [activated, loadMessages]);

  // Appends a message and clears any matching pending send — used for both
  // the sender's own POST response AND the WebSocket broadcast of the same
  // message, in whichever order they arrive (no ordering guarantee between
  // the two transports). Deduped by real server id, so whichever of the two
  // arrives second is a no-op.
  const upsertMessage = useCallback((incoming: CommunityMessage) => {
    setMessages((prev) => {
      if (prev.some((existing) => existing.id === incoming.id)) return prev;
      shouldScrollRef.current = true;
      return [...prev, incoming];
    });
    setPending((prev) => (prev && prev.clientMessageId === incoming.clientMessageId ? null : prev));
  }, []);

  const { status: connectionStatus, retryNow } = useCommunityChatSocket(activated, upsertMessage);

  useEffect(() => {
    if (!shouldScrollRef.current) return;
    shouldScrollRef.current = false;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (pending) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [pending]);

  const mapErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError && error.status === 429) return t.communityChat.rateLimited;
    return t.communityChat.failedGeneric;
  };

  const submitMessage = async (clientMessageId: string, content: string) => {
    setPending({ clientMessageId, content, status: 'sending' });
    try {
      const result = await sendCommunityMessage(clientMessageId, content);
      upsertMessage(result);
    } catch (error) {
      setPending((prev) => {
        // Already reconciled by a WS broadcast that beat the POST response
        // back — the send actually succeeded; don't clobber that with a
        // spurious failure just because this response errored afterward.
        if (!prev || prev.clientMessageId !== clientMessageId) return prev;
        return { clientMessageId, content, status: 'failed', error: mapErrorMessage(error) };
      });
    }
  };

  const handleSend = () => {
    const trimmed = composerText.trim();
    if (!trimmed || pending !== null) return;
    setComposerText('');
    void submitMessage(newUuidV4(), trimmed);
  };

  const handleRetry = () => {
    if (!pending) return;
    void submitMessage(pending.clientMessageId, pending.content);
  };

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    const oldestId = messages[0].id;
    const container = listRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const result = await listCommunityMessages(oldestId);
      setMessages((prev) => [...result.data, ...prev]);
      setHasMore(result.meta.hasMore);
      // Restore the visual scroll position after prepending — otherwise the
      // browser keeps scrollTop numerically fixed, which visually yanks the
      // list down to the newly-prepended rows instead of keeping the
      // student's place.
      requestAnimationFrame(() => {
        if (!container) return;
        container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
      });
    } catch {
      // Best-effort: a failed "load older" just leaves the list as-is — the
      // student can scroll up again to retry, same "a restore failure never
      // blocks the rest of the experience" precedent EngyChatView's session
      // restore uses.
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    if ((listRef.current?.scrollTop ?? 0) < 40) void loadOlderMessages();
  };

  const filters: CommunityFilterChip[] = [{ id: 'all', label: t.communityChat.filterAll }];
  const composerDisabled = pending !== null;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
            <Users size={16} className="text-violet-600 dark:text-violet-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {t.communityChat.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.communityChat.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadMessages}
          aria-label={t.communityChat.refresh}
          title={t.communityChat.refresh}
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <CommunityFilterBar filters={filters} activeFilterId="all" />

      {connectionStatus === 'reconnecting' && (
        <div className="px-4 py-1.5 text-center text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 shrink-0">
          {t.communityChat.reconnecting}
        </div>
      )}
      {connectionStatus === 'disconnected' && (
        <div className="px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 shrink-0">
          <span>{t.communityChat.disconnected}</span>
          <button type="button" onClick={retryNow} className="font-semibold underline hover:no-underline">
            {t.communityChat.retryConnection}
          </button>
        </div>
      )}

      <div
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-label={t.communityChat.messageListLabel}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
      >
        {loadState === 'loading' && (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-2/3 ml-auto" />
            <Skeleton className="h-12 w-3/5" />
          </div>
        )}

        {loadState === 'error' && (
          <ErrorState message={t.communityChat.loadError} onRetry={loadMessages} />
        )}

        {loadState === 'ready' && messages.length === 0 && !pending && (
          <EmptyState icon={<Users size={32} />} message={t.communityChat.emptyMessage} />
        )}

        {loadState === 'ready' && (
          <>
            {loadingOlder && (
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                {t.communityChat.loadingOlder}
              </p>
            )}
            {messages.map((message) => (
              <CommunityMessageBubble
                key={message.id}
                message={message}
                isOwn={message.author.id === currentUserId}
              />
            ))}

            {pending && (
              <div className="flex justify-end">
                <div className="max-w-[78%] flex flex-col items-end">
                  <div
                    className={`rounded-2xl rounded-br-sm bg-blue-600 text-white px-3.5 py-2 text-sm max-w-full ${
                      pending.status === 'sending' ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="whitespace-pre-wrap break-words">{pending.content}</span>
                  </div>
                  {pending.status === 'sending' && (
                    <span className="mt-1 px-1 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                      <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                      {t.communityChat.sending}
                    </span>
                  )}
                  {pending.status === 'failed' && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                      <span>{pending.error}</span>
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="font-semibold underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
                      >
                        {t.communityChat.retry}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <CommunityComposer
        value={composerText}
        onChange={setComposerText}
        onSend={handleSend}
        disabled={composerDisabled}
        maxLength={MAX_COMMUNITY_MESSAGE_LENGTH}
      />
    </>
  );
};

export default CommunityChatPanel;
