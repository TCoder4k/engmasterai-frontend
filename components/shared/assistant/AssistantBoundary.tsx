import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  AssistantContext,
  AssistantContextValue,
  AssistantLockContext,
  AssistantLockEntry,
  AssistantTool,
} from './useAssistant';
import AssistantLauncher from './AssistantLauncher';
import DictionaryPanel from './DictionaryPanel';

// Floating Dictionary + Engy shell, Phase A.
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
// frontend: no runtime route check, just route nesting. (The backend
// independently re-checks this for POST /chat/messages once Phase B ships —
// see docs/CLAUDE.md.)
const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTool, setActiveToolState] = useState<AssistantTool | null>(null);
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
  const launcherRef = useRef<HTMLButtonElement>(null);

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

  const value = useMemo<AssistantContextValue>(
    () => ({
      activeTool: isLocked ? null : activeTool,
      openTool,
      closeTool,
      toggleTool,
      launcherRef,
    }),
    [activeTool, isLocked, openTool, closeTool, toggleTool],
  );

  return (
    <AssistantLockContext.Provider value={lockValue}>
      <AssistantContext.Provider value={value}>
        {children}
        {!isLocked && <AssistantLauncher />}
        {value.activeTool === 'dictionary' && <DictionaryPanel />}
      </AssistantContext.Provider>
    </AssistantLockContext.Provider>
  );
};

const AssistantBoundary: React.FC = () => (
  <AssistantProvider>
    <Outlet />
  </AssistantProvider>
);

export default AssistantBoundary;
