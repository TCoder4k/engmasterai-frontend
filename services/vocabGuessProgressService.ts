import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Persistent, per-deck progress for the "Guess the Word" vocabulary
// practice mode — deliberately NOT the SRS engine (see learningService.ts's
// submitReview). No ratings, no due dates: a word is either learned in this
// deck (answered correctly at least once) or it isn't. See
// VocabGuessProgress in the backend's schema.prisma for the full rationale.
export interface GuessProgressSummary {
  deckId: string;
  totalWords: number;
  learnedWordIds: string[];
}

export interface GuessProgressWord {
  wordId: string;
  learnedAt: string;
}

export const getDeckGuessProgress = async (deckId: string): Promise<GuessProgressSummary> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab/decks/${deckId}/guess-progress`);

  if (!response.ok) return throwApiError(response, 'Failed to load Guess-the-Word progress');
  return response.json();
};

// Sticky, first-correct-wins — calling this again for an already-learned
// word is a harmless no-op (see the backend's own comment). There is
// deliberately no equivalent call for a wrong/skipped answer: the absence
// of a row already means "not learned", so there is nothing to persist.
export const markGuessWordLearned = async (
  deckId: string,
  wordId: string,
): Promise<GuessProgressWord> => {
  const response = await apiFetch(
    `${API_BASE_URL}/vocab/decks/${deckId}/guess-progress/words/${wordId}`,
    { method: 'POST' },
  );

  if (!response.ok) return throwApiError(response, 'Failed to save progress');
  return response.json();
};

// Powers "Học lại toàn bộ" — destructive, so the caller must gate this
// behind an explicit confirmation before ever calling it.
export const resetDeckGuessProgress = async (deckId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab/decks/${deckId}/guess-progress`, {
    method: 'DELETE',
  });

  if (!response.ok) return throwApiError(response, 'Failed to reset progress');
};
