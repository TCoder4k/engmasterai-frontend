import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  AssistantContext,
  AssistantContextValue,
  AssistantLessonContext,
  AssistantLessonContextSetter,
  AssistantLockContext,
  AssistantLockEntry,
  AssistantTool,
  ChatHandoffPayload,
} from './useAssistant';
import AssistantLauncher from './AssistantLauncher';
import DictionaryPanel from './DictionaryPanel';
import ChatPanel from './ChatPanel';
import { getUnreadCommunityMessageCount } from '../../../services/communityChatService';
import { useCommunityChatSocket } from './community-chat/useCommunityChatSocket';
import { authService } from '../../../services/authService';
import {
  readCommunityNotificationsMuted,
  writeCommunityNotificationsMuted,
} from '../../../services/communityNotificationPreference';

const COMMUNITY_UNREAD_POLL_INTERVAL_MS = 60_000;
// Same debounce window CommunityChatPanel.tsx's own live-message reaction
// uses — a burst of several messages must produce one refetch, not one per
// message.
const COMMUNITY_BADGE_LIVE_DEBOUNCE_MS = 500;

// Floating Dictionary + Engy shell, Phase A + Phase B + Phase C.
//
// WHY A LAYOUT ROUTE, nested in App.tsx alongside GamificationBoundary/
// StudyTimeBoundary — same structural reasons as both: mounted once per
// session (a page-level provider would remount on every navigation, since
// every student page renders its own StudentLayout), and excluded from
// admin BY STRUCTURE (that route group sits entirely outside this one).
//
// It ALSO excludes `/onboarding` and `/onboarding/retake` by the exact same
// structural mechanism — those two routes already sit outside
// GamificationBoundary/StudyTimeBoundary today, and this boundary is nested
// at the same level, so it never wraps them either. That is the WHOLE
// enforcement of "Engy is unavailable during the Placement Test" on the
// frontend: no runtime route check, just route nesting. The backend
// independently re-checks the same fact for POST /chat/messages
// (AssessmentLockService) — never trusts this route exclusion alone.
const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTool, setActiveToolState] = useState<AssistantTool | null>(null);
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
  // TWO refs, not one — Phase B added a second, independent trigger
  // (Engy chat) beside Dictionary's. See useAssistant.ts's
  // AssistantLauncherRefs doc comment for why each panel needs its OWN.
  const dictionaryLauncherRef = useRef<HTMLButtonElement>(null);
  const chatLauncherRef = useRef<HTMLButtonElement>(null);
  // Phase C
  const [lessonContext, setLessonContext] = useState<AssistantLessonContext | null>(null);
  const [pendingHandoff, setPendingHandoff] = useState<ChatHandoffPayload | null>(null);
  // Community Chat unread badge — polled here (not inside AssistantLauncher/
  // ChatToolTabBar individually) so both badge locations share one number,
  // same REST-poll-only precedent as NotificationBell.tsx (no WebSocket
  // involved in the count itself).
  const [communityUnreadCount, setCommunityUnreadCount] = useState(0);
  // The bell dropdown in ChatPanel.tsx's header — a per-user, local-only
  // preference (see communityNotificationPreference.ts's own doc comment).
  // Lazy initializer reads localStorage exactly once, on first mount.
  const [communityNotificationsMuted, setCommunityNotificationsMutedState] = useState(() =>
    readCommunityNotificationsMuted(authService.getUser()?.id ?? ''),
  );
  const setCommunityNotificationsMuted = useCallback((muted: boolean) => {
    writeCommunityNotificationsMuted(authService.getUser()?.id ?? '', muted);
    setCommunityNotificationsMutedState(muted);
  }, []);

  const registerLock = useCallback((id: number, entry: AssistantLockEntry) => {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (entry.active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const unregisterLock = useCallback((id: number) => {
    setLockedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isLocked = lockedIds.size > 0;

  // A lock kicking in (the student starts recording) closes whatever panel
  // happens to be open already, same as the launcher itself disappearing.
  useEffect(() => {
    if (isLocked) setActiveToolState(null);
  }, [isLocked]);

  const openTool = useCallback((tool: AssistantTool) => setActiveToolState(tool), []);
  const closeTool = useCallback(() => setActiveToolState(null), []);
  // ONE SLOT, not a queue: opening a second tool always replaces the first
  // rather than stacking surfaces — "only one assistant surface open at
  // once" per the approved plan.
  const toggleTool = useCallback((tool: AssistantTool) => {
    setActiveToolState((current) => (current === tool ? null : tool));
  }, []);

  const lockValue = useMemo(
    () => ({ register: registerLock, unregister: unregisterLock }),
    [registerLock, unregisterLock],
  );

  const lessonContextSetterValue = useMemo(() => ({ set: setLessonContext }), []);

  // Opening the hand-off always OPENS chat too — "Ask Engy about this
  // word" is a navigation action, not just a background state update.
  const handoffToChat = useCallback((payload: ChatHandoffPayload) => {
    setPendingHandoff(payload);
    setActiveToolState('chat');
  }, []);
  const consumeHandoff = useCallback(() => setPendingHandoff(null), []);

  const refreshCommunityUnreadCount = useCallback(() => {
    getUnreadCommunityMessageCount()
      .then(setCommunityUnreadCount)
      .catch(() => {
        // Best-effort — a failed poll just leaves the last known count, same
        // convention as NotificationBell.tsx's refreshUnreadCount.
      });
  }, []);

  useEffect(() => {
    refreshCommunityUnreadCount();
    const interval = window.setInterval(
      refreshCommunityUnreadCount,
      COMMUNITY_UNREAD_POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [refreshCommunityUnreadCount]);

  // 2026-08-26 follow-up — the poll above plus CommunityChatPanel's own
  // live-reaction (once Tán gẫu has been opened at least once) still left
  // the badge only ever moving on refresh for a student who has NEVER
  // opened the chat panel at all — reported directly, and confirmed via
  // AskUserQuestion to be the actual common case. Fixing that requires a
  // live connection to exist before that first open, so this is a SECOND,
  // independent socket, always on regardless of chat panel state — deliberately
  // not reusing/moving CommunityChatPanel's own socket (that one still owns
  // live message rendering + its reconnect-status banner while the tab is
  // open; restructuring it to share a connection was assessed and rejected
  // as more regression risk than the resource saving is worth at this app's
  // scale). No author check needed: GET /community/messages/unread-count
  // already excludes the viewer's own messages server-side.
  const communityBadgeReactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCommunityLiveMessageForBadge = useCallback(() => {
    if (communityBadgeReactionTimerRef.current) clearTimeout(communityBadgeReactionTimerRef.current);
    communityBadgeReactionTimerRef.current = setTimeout(
      refreshCommunityUnreadCount,
      COMMUNITY_BADGE_LIVE_DEBOUNCE_MS,
    );
  }, [refreshCommunityUnreadCount]);
  useEffect(
    () => () => {
      if (communityBadgeReactionTimerRef.current) clearTimeout(communityBadgeReactionTimerRef.current);
    },
    [],
  );
  // No connection-status UI surfaced for this one (no reconnect banner, no
  // retry button) — a background badge-sync connection failing just leaves
  // the 60s poll as the fallback, same as before this fix existed; not
  // worth alarming the student the way a failed Tán gẫu-panel connection is.
  useCommunityChatSocket(true, handleCommunityLiveMessageForBadge);

  const value = useMemo<AssistantContextValue>(
    () => ({
      activeTool: isLocked ? null : activeTool,
      openTool,
      closeTool,
      toggleTool,
      launcherRefs: { dictionary: dictionaryLauncherRef, chat: chatLauncherRef },
      lessonContext,
      pendingHandoff,
      handoffToChat,
      consumeHandoff,
      // Masked at this single source rather than at each badge consumer —
      // see useAssistant.ts's doc comment on communityNotificationsMuted for
      // why AssistantLauncher/ChatToolTabBar need zero code changes for this.
      communityUnreadCount: communityNotificationsMuted ? 0 : communityUnreadCount,
      refreshCommunityUnreadCount,
      communityNotificationsMuted,
      setCommunityNotificationsMuted,
    }),
    [
      activeTool,
      isLocked,
      openTool,
      closeTool,
      toggleTool,
      lessonContext,
      pendingHandoff,
      handoffToChat,
      consumeHandoff,
      communityUnreadCount,
      refreshCommunityUnreadCount,
      communityNotificationsMuted,
      setCommunityNotificationsMuted,
    ],
  );

  return (
    <AssistantLockContext.Provider value={lockValue}>
      <AssistantLessonContextSetter.Provider value={lessonContextSetterValue}>
        <AssistantContext.Provider value={value}>
          {children}
          {!isLocked && <AssistantLauncher />}
          {value.activeTool === 'dictionary' && <DictionaryPanel />}
          {value.activeTool === 'chat' && <ChatPanel />}
        </AssistantContext.Provider>
      </AssistantLessonContextSetter.Provider>
    </AssistantLockContext.Provider>
  );
};

const AssistantBoundary: React.FC = () => (
  <AssistantProvider>
    <Outlet />
  </AssistantProvider>
);

export default AssistantBoundary;
