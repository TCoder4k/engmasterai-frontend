import { createContext, useContext, useEffect, useRef } from 'react';
import type { ChatContextInput, LessonContextStage } from '../../../services/chatService';

// Split into its own module (no components here) specifically so
// AssistantBoundary.tsx can import AssistantLauncher/DictionaryPanel AND
// those two can import the hooks below without a circular import between
// the three files.

export type AssistantTool = 'dictionary' | 'chat';

/**
 * One ref PER trigger button, not a single shared one — Phase B adds a
 * second, independent launcher (Engy chat) beside Dictionary's, and each
 * panel's outside-click/Escape handling must exclude only ITS OWN trigger
 * (see DictionaryPanel.tsx/ChatPanel.tsx), both to avoid a same-button
 * double-toggle race and so focus restoration on close returns to the
 * button that actually opened that panel.
 */
export interface AssistantLauncherRefs {
  dictionary: React.RefObject<HTMLButtonElement>;
  chat: React.RefObject<HTMLButtonElement>;
}

/** What LessonPage is currently showing — set via useAssistantLessonContext. */
export interface AssistantLessonContext {
  lessonId: string;
  stage: LessonContextStage;
}

/**
 * Phase C — a ONE-SHOT context override for the NEXT message only (not the
 * whole conversation), consumed by ChatPanel via consumeHandoff(). Used by
 * DictionaryPanel's "Ask Engy about this word" button: it prefills a
 * question and — only for that one message — attaches the word's real
 * VocabWordId (or falls back to GENERAL when the lookup did not come from a
 * real VocabWord row). Subsequent messages in the same conversation revert
 * to the ambient lessonContext (if any) or GENERAL.
 */
export interface ChatHandoffPayload {
  prefillMessage: string;
  context: ChatContextInput;
}

export interface AssistantContextValue {
  /** Never a tool while a lock (see useAssistantLock) is active. */
  activeTool: AssistantTool | null;
  openTool: (tool: AssistantTool) => void;
  closeTool: () => void;
  toggleTool: (tool: AssistantTool) => void;
  launcherRefs: AssistantLauncherRefs;
  /** Whatever LessonPage most recently registered, or null off that page. */
  lessonContext: AssistantLessonContext | null;
  /** Set by DictionaryPanel, consumed once by ChatPanel. */
  pendingHandoff: ChatHandoffPayload | null;
  handoffToChat: (payload: ChatHandoffPayload) => void;
  consumeHandoff: () => void;
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

export interface AssistantLessonContextSetterValue {
  set: (context: AssistantLessonContext | null) => void;
}

export const AssistantLessonContextSetter =
  createContext<AssistantLessonContextSetterValue | null>(null);

/**
 * Phase C — LessonPage calls this to tell the assistant shell "the student
 * is currently viewing lesson X at stage Y", so ChatPanel can attach
 * `context: {type:'LESSON', resourceId, stage}` to every message sent while
 * this is registered, automatically. Registers on mount/update, clears on
 * unmount — same register/unregister-on-cleanup idiom as useAssistantLock,
 * but a single current value rather than a Set, since only one page can be
 * "the current lesson" at a time.
 *
 * Deliberately keyed on primitives (`lessonId`, `stage`) in the dependency
 * array, not the `context` object itself, so a fresh object literal passed
 * by the caller on every render does not re-fire the effect.
 */
export const useAssistantLessonContext = (context: AssistantLessonContext | null): void => {
  const setter = useContext(AssistantLessonContextSetter);
  const lessonId = context?.lessonId;
  const stage = context?.stage;

  useEffect(() => {
    if (!setter) return;
    setter.set(lessonId && stage ? { lessonId, stage } : null);
    return () => setter.set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setter, lessonId, stage]);
};
