// Personalized Onboarding & Placement Test — draft-only resume state for the
// wizard's PlacementTestStep, mirroring quizDraft.ts's own contract exactly.
//
// sessionStorage (not localStorage): scoped to this tab's session, not
// carried across browser restarts. Holds ONLY `{ currentIndex }` — never
// answers (those are already durably recorded server-side via
// POST .../answer the moment the student picks one) and NEVER the timer.
// The countdown is always recomputed from the server's `expiresAt` on every
// load (see OnboardingPage), never from a locally-stored remaining-seconds
// value — a closed-and-reopened tab must show the CORRECT remaining time,
// not a naively-continued local clock that ignores time passed while the
// tab was shut.
//
// Unlike quizDraft.ts, there is no per-lesson key component: a student has
// at most ONE placement attempt in flight at a time, so the key is scoped
// by userId alone.

export interface PlacementDraft {
  currentIndex: number;
}

const keyFor = (userId: string) => `placementAttempt:${userId}`;

export const readPlacementDraft = (userId: string): PlacementDraft | null => {
  try {
    const raw = sessionStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as PlacementDraft) : null;
  } catch {
    return null;
  }
};

export const writePlacementDraft = (userId: string, draft: PlacementDraft): void => {
  try {
    sessionStorage.setItem(keyFor(userId), JSON.stringify(draft));
  } catch {
    // Best-effort — a full/unavailable sessionStorage must never break the
    // placement test; the server remains the source of truth regardless.
  }
};

// Called once the attempt is submitted (or on logout) — a shared device
// must never resume a stale index under a finished attempt or the next
// account.
export const clearPlacementDraft = (userId: string): void => {
  try {
    sessionStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
};
