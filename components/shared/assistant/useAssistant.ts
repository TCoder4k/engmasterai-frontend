import { createContext, useContext, useEffect, useRef } from 'react';

// Split into its own module (no components here) specifically so
// AssistantBoundary.tsx can import AssistantLauncher/DictionaryPanel AND
// those two can import the hooks below without a circular import between
// the three files.

export type AssistantTool = 'dictionary' | 'chat';

export interface AssistantContextValue {
  /** Never a tool while a lock (see useAssistantLock) is active. */
  activeTool: AssistantTool | null;
  openTool: (tool: AssistantTool) => void;
  closeTool: () => void;
  toggleTool: (tool: AssistantTool) => void;
  /** Shared with panels so Escape/outside-click can restore focus to it. */
  launcherRef: React.RefObject<HTMLButtonElement>;
}

export const AssistantContext = createContext<AssistantContextValue | null>(null);

/**
 * Returns `null` outside the boundary (admin routes, `/onboarding`, tests)
 * rather than throwing — same convention as useGamification/useStudyActivity,
 * so a shared component doesn't crash a page it also happens to render on.
 */
export const useAssistant = (): AssistantContextValue | null => useContext(AssistantContext);

export interface AssistantLockEntry {
  active: boolean;
  reason: 'uxRecording';
}

export interface AssistantLockContextValue {
  register: (id: number, entry: AssistantLockEntry) => void;
  unregister: (id: number) => void;
}

export const AssistantLockContext = createContext<AssistantLockContextValue | null>(null);

let nextLockId = 0;

/**
 * Declares that the assistant launcher should hide while `active` is true.
 *
 * Today's one caller is the Shadowing recorder, and this is a UX precaution
 * only — the round mic button and the assistant's own round trigger must
 * never compete for the same corner mid-recording. It is NOT an
 * assessment-integrity control: Engy stays fully available during Quiz/Trap
 * Hunter/Advanced Practice by product decision (docs/CLAUDE.md), and the
 * Placement Test is excluded by route structure instead (AssistantBoundary
 * simply never wraps `/onboarding`).
 */
export const useAssistantLock = ({ active, reason }: AssistantLockEntry): void => {
  const context = useContext(AssistantLockContext);
  const idRef = useRef<number>(-1);
  if (idRef.current === -1) idRef.current = (nextLockId += 1);

  useEffect(() => {
    if (!context) return;
    context.register(idRef.current, { active, reason });
    return () => context.unregister(idRef.current);
  }, [context, active, reason]);
};
