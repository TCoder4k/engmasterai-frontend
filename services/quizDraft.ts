import { SubmittedAnswer } from './quizService';

// Sprint 06B — draft-only persistence for an in-progress quiz attempt.
// sessionStorage (not localStorage): a draft answer is scoped to this tab's
// session, not carried across browser restarts, and "Back navigation must
// preserve progress" only means surviving a refresh/back within the same
// visit. Correctness NEVER lives here — this is exactly what the student
// typed, not whether it's right; grading only ever happens server-side.
// Same service tier as videoProgress.ts/lessonProgress.ts, deliberately
// NOT inside components/lesson/quiz/ — services must not depend on
// components, and authService.logout() needs to clear this alongside the
// other device-local stores it already clears.

export interface QuizDraft {
  clientAttemptId: string;
  answers: Record<string, SubmittedAnswer>;
  currentIndex: number;
}

const keyFor = (userId: string, lessonId: string) => `quizAttempt:${userId}:${lessonId}`;

export const readQuizDraft = (userId: string, lessonId: string): QuizDraft | null => {
  try {
    const raw = sessionStorage.getItem(keyFor(userId, lessonId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as QuizDraft) : null;
  } catch {
    return null;
  }
};

export const writeQuizDraft = (userId: string, lessonId: string, draft: QuizDraft): void => {
  try {
    sessionStorage.setItem(keyFor(userId, lessonId), JSON.stringify(draft));
  } catch {
    // Best-effort — a full/unavailable sessionStorage must never break the quiz.
  }
};

export const clearQuizDraft = (userId: string, lessonId: string): void => {
  try {
    sessionStorage.removeItem(keyFor(userId, lessonId));
  } catch {
    // ignore
  }
};

// Called on logout — a shared device must never resume a draft attempt under
// the next account.
//
// Sprint 07: this is now the ONLY device-local learning state that needs
// clearing. Video and theory completion used to be cleared alongside it; both
// moved to the server, so the next account sees its own progress by
// construction rather than by anyone remembering to wipe the previous one.
export const clearAllQuizDrafts = (userId: string): void => {
  const prefix = `quizAttempt:${userId}:`;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
};
