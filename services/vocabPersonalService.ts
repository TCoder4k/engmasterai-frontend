import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import { LearningState, ReviewRating } from './learningService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// "Từ vựng của tôi" (My Vocabulary) — a student's own word list, reviewed
// through its own queue (see backend's vocab-personal module). Mirrors
// learningService.ts's LearningState/ReviewRating rather than redefining
// them — same enum, same values, one source of truth in this frontend too.

export interface PersonalVocabWord {
  id: string;
  text: string;
  ipa: string | null;
  meaningVi: string;
  meaningEn: string | null;
  audioUrl: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  tags: string[];
  state: LearningState;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  nextReviewAt: string | null;
  firstLearnedAt: string | null;
  masteredAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type PersonalWordStatusFilter = 'all' | 'new' | 'learning' | 'mastered';
export type PersonalWordSort = 'newest' | 'oldest' | 'alphabetical';

export interface ListPersonalVocabWordsParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: PersonalWordStatusFilter;
  tag?: string;
  sort?: PersonalWordSort;
  // Powers the sidebar's "Bắt đầu ôn tập" — the same due-today definition
  // GET /vocab-personal/stats' dueTodayCount uses, so the sidebar's count
  // and the actual session word list can never disagree.
  dueOnly?: boolean;
}

export interface PersonalVocabWordListResponse {
  data: PersonalVocabWord[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const getPersonalVocabWords = async (
  params: ListPersonalVocabWordsParams = {},
): Promise<PersonalVocabWordListResponse> => {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.tag) query.set('tag', params.tag);
  if (params.sort) query.set('sort', params.sort);
  if (params.dueOnly) {
    query.set('dueOnly', 'true');
    query.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  const qs = query.toString();
  const response = await apiFetch(`${API_BASE_URL}/vocab-personal/words${qs ? `?${qs}` : ''}`);

  if (!response.ok) return throwApiError(response, 'Failed to load your vocabulary');
  return response.json();
};

// Walks every page (the backend caps a single page at 50 — see
// vocab-personal.service.ts's MAX_LIMIT) to gather every word matching
// `params`. For the Flashcard/Dictation tabs' "practice everything" and the
// sidebar's due-only review — sessions genuinely need the full set, not one
// page of it, or a student with more than 50 saved words would silently
// never see the rest in a session.
const LIST_ALL_PAGE_LIMIT = 50;

export const getAllPersonalVocabWords = async (
  params: Omit<ListPersonalVocabWordsParams, 'page' | 'limit'> = {},
): Promise<PersonalVocabWord[]> => {
  const all: PersonalVocabWord[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getPersonalVocabWords({ ...params, page, limit: LIST_ALL_PAGE_LIMIT });
    all.push(...res.data);
    if (res.data.length === 0 || page >= res.meta.totalPages) break;
    page += 1;
  }
  return all;
};

export interface CreatePersonalVocabWordInput {
  text: string;
  ipa?: string;
  meaningVi: string;
  meaningEn?: string;
  audioUrl?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  tags?: string[];
}

export const createPersonalVocabWord = async (
  input: CreatePersonalVocabWordInput,
): Promise<PersonalVocabWord> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab-personal/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) return throwApiError(response, 'Failed to save this word');
  return response.json();
};

export interface BulkCreatePersonalVocabWordsResponse {
  createdCount: number;
  skippedCount: number;
  skippedWords: string[];
}

// The bulk endpoint only persists already-resolved records — every
// /dictionary/lookup call for a pasted list happens on this side (see
// ImportPersonalWordsModal), throttled to the real backend rate limit
// (dictionaryService.lookupWord's own doc comment / dictionary.controller.ts:
// 40 requests per 60s, keyed per authenticated user).
export const bulkCreatePersonalVocabWords = async (
  words: CreatePersonalVocabWordInput[],
): Promise<BulkCreatePersonalVocabWordsResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab-personal/words/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });

  if (!response.ok) return throwApiError(response, 'Failed to import your words');
  return response.json();
};

export interface UpdatePersonalVocabWordInput {
  text?: string;
  ipa?: string | null;
  meaningVi?: string;
  meaningEn?: string | null;
  audioUrl?: string | null;
  exampleSentence?: string | null;
  exampleTranslation?: string | null;
  tags?: string[];
}

export const updatePersonalVocabWord = async (
  id: string,
  input: UpdatePersonalVocabWordInput,
): Promise<PersonalVocabWord> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab-personal/words/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update this word');
  return response.json();
};

export const deletePersonalVocabWord = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab-personal/words/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) await throwApiError(response, 'Failed to delete this word');
};

export interface SubmitPersonalWordReviewInput {
  rating: ReviewRating;
  clientReviewId: string;
}

export interface PersonalWordReviewResponse {
  state: LearningState;
  intervalDays: number;
  nextReviewAt: string;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  version: number;
}

export const submitPersonalWordReview = async (
  id: string,
  input: SubmitPersonalWordReviewInput,
): Promise<PersonalWordReviewResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab-personal/words/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) return throwApiError(response, 'Failed to submit this review');
  return response.json();
};

export interface PersonalVocabStats {
  total: number;
  mastered: number;
  learning: number;
  new: number;
  dueTodayCount: number;
  struggledCount: number;
  reviewsLast7Days: { date: string; count: number }[];
}

export const getPersonalVocabStats = async (): Promise<PersonalVocabStats> => {
  // Same as getDashboardAnalytics/getLibrariesProgress: sent read-only, just
  // buckets "today" for dueTodayCount — never writes User.timezone (only the
  // curated-deck due-queue endpoint bootstraps that column).
  const params = new URLSearchParams({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const response = await apiFetch(`${API_BASE_URL}/vocab-personal/stats?${params}`);

  if (!response.ok) return throwApiError(response, 'Failed to load your vocabulary stats');
  return response.json();
};
