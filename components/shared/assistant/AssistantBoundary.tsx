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
