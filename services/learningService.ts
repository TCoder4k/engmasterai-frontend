import { throwApiError, ApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Mirrors the backend's LearningState/ReviewRating/PracticeSource enums
// (prisma/schema.prisma) exactly — see docs/adr/007-learning-engine-srs.md.
export type LearningState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING' | 'MASTERED';
export type ReviewRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
export type PracticeSource = 'FLASHCARD' | 'DICTATION' | 'REVIEW';

// The two distinct 409 codes the backend can return for a review
// submission (never just a bare 409 — the frontend must react differently
// to each: a version conflict means "silently refetch and retry", an
// idempotency-key reuse means "this is a client bug, surface it").
export const IDEMPOTENCY_KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED';
export const VERSION_CONFLICT = 'VERSION_CONFLICT';

export interface WordProgress {
  state: LearningState;
  intervalDays: number;
  nextReviewAt: string;
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

export interface PreviewIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface WordProgressResponse {
  progress: WordProgress | null;
  previewIntervals: PreviewIntervals;
}

export interface SubmitReviewDto {
  rating: ReviewRating;
  practiceMode: PracticeSource;
  sessionId?: string;
  responseTimeMs?: number;
  clientReviewId: string;
}

// The authoritative post-review progress — never computed client-side
// (backend owns scheduling). Identical shape whether this is a fresh
// submission or an idempotent replay of an already-recorded one.
export type ReviewResponse = WordProgress & { version: number };

// A word's current progress + what each of the four ratings would produce
// right now, computed server-side with zero persistence. Outside the due
// queue on purpose — Flashcard practices a whole deck, not just due words,
// so it needs this regardless of whether the word is actually due today.
export const getWordProgress = async (wordId: string): Promise<WordProgressResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/learning/words/${wordId}/progress`);

  if (!response.ok) return throwApiError(response, 'Failed to load word progress');
  return response.json();
};

export const submitReview = async (wordId: string, dto: SubmitReviewDto): Promise<ReviewResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/learning/words/${wordId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to submit review');
  return response.json();
};

export const isIdempotencyKeyReused = (error: unknown): boolean =>
  error instanceof ApiError && error.code === IDEMPOTENCY_KEY_REUSED;

export const isVersionConflict = (error: unknown): boolean =>
  error instanceof ApiError && error.code === VERSION_CONFLICT;

// --- Sprint 04D: due-review queue + deck/library progress ---

export interface QueryDueReviewsParams {
  limit?: number;
  deckId?: string;
  libraryId?: string;
  includeNew?: boolean;
  newLimit?: number;
  // The caller's IANA timezone (e.g. via Intl.DateTimeFormat().resolvedOptions().timeZone).
  // Only ever used by the backend to bootstrap User.timezone the first
  // time it's null — safe to send on every call.
  tz?: string;
}

export interface DueQueueWord {
  id: string;
  text: string;
  ipa: string | null;
  cefrLevel: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  meanings: { id: string; partOfSpeech: string | null; meaning: string; orderIndex: number }[];
}

export interface DueQueueItem {
  word: DueQueueWord;
  isNew: boolean;
  progress: WordProgress | null;
  previewIntervals: PreviewIntervals;
}

export interface DueQueueResponse {
  data: DueQueueItem[];
}

export const getDueReviews = async (params: QueryDueReviewsParams = {}): Promise<DueQueueResponse> => {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.deckId) query.set('deckId', params.deckId);
  if (params.libraryId) query.set('libraryId', params.libraryId);
  if (params.includeNew !== undefined) query.set('includeNew', String(params.includeNew));
  if (params.newLimit !== undefined) query.set('newLimit', String(params.newLimit));
  if (params.tz) query.set('tz', params.tz);

  const qs = query.toString();
  const response = await apiFetch(`${API_BASE_URL}/learning/reviews/due${qs ? `?${qs}` : ''}`);

  if (!response.ok) return throwApiError(response, 'Failed to load due reviews');
  return response.json();
};

// Real per-state counts (§13). The two percentages mean different things and
// must never be collapsed into one bar:
//   startedPercent  — exposure: words rated at least once. Rating AGAIN on
//                     every word in a deck reaches 100% while having learned
//                     nothing, which is exactly why it is not called
//                     "progressPercent".
//   masteredPercent — quality: masteredWords / totalWords.
export interface DeckProgress {
  deckId: string;
  totalWords: number;
  newWords: number;
  learningWords: number;
  reviewWords: number;
  masteredWords: number;
  dueWords: number;
  startedPercent: number;
  masteredPercent: number;
}

export interface LibraryProgress {
  libraryId: string;
  totalWords: number;
  newWords: number;
  learningWords: number;
  reviewWords: number;
  masteredWords: number;
  dueWords: number;
  startedPercent: number;
  masteredPercent: number;
  // Counting rule: each deck's `totalWords` counts unique words WITHIN that
  // deck, while this object's own `totalWords` counts unique words across
  // the whole library. A word attached to two decks is counted in both decks
  // but only once library-wide, so summing `decks[].totalWords` can exceed
  // `totalWords` — that is intended, not a bug (the TOEIC 600 library really
  // does have 610 distinct words across 615 attachments).
  decks: DeckProgress[];
}

// One summary row per published library, for the library grid. Deliberately
// without the per-deck breakdown — that only matters once a specific library
// is opened.
export interface LibrarySummaryProgress {
  libraryId: string;
  deckCount: number;
  totalWords: number;
  newWords: number;
  learningWords: number;
  reviewWords: number;
  masteredWords: number;
  dueWords: number;
  startedPercent: number;
  masteredPercent: number;
}

export const getDeckProgress = async (deckId: string): Promise<DeckProgress> => {
  const response = await apiFetch(`${API_BASE_URL}/learning/decks/${deckId}/progress`);

  if (!response.ok) return throwApiError(response, 'Failed to load deck progress');
  return response.json();
};

export const getLibraryProgress = async (libraryId: string): Promise<LibraryProgress> => {
  const response = await apiFetch(`${API_BASE_URL}/learning/libraries/${libraryId}/progress`);

  if (!response.ok) return throwApiError(response, 'Failed to load library progress');
  return response.json();
};

// Sprint 09 follow-up — the daily NEW-word allowance, reported beside the
// per-library rows because the quota is per user per day, not per library.
//
// This exists because the dashboard summed `dueWords` and promised "23 từ đang
// chờ", then the session opened with "Còn lại: 38". Both numbers were correct:
// `dueWords` counts only words already learned and now due, while the review
// queue is topped up with new words. `availableNow` is the missing 15.
export interface DailyNewWords {
  dailyLimit: number;
  introducedToday: number;
  /** Add to `dueWords` to predict the session size. */
  availableNow: number;
}

export interface LibrariesProgressResponse {
  data: LibrarySummaryProgress[];
  dailyNewWords: DailyNewWords;
}

export const getLibrariesProgress = async (): Promise<LibrariesProgressResponse> => {
  // Same timezone the review session sends, so both agree on what "today"
  // means when spending the daily quota.
  const params = new URLSearchParams({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const response = await apiFetch(
    `${API_BASE_URL}/learning/libraries/progress?${params}`,
  );

  if (!response.ok) return throwApiError(response, 'Failed to load library progress');
  return response.json();
};
