import { CefrLevel } from '../types';
import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';
import type {
  ListeningMediaProvider,
  ListeningMediaType,
  ListeningMode,
} from './listeningAdminService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 11 Phase 2 — the STUDENT Listening API surface.
//
// WHY THIS FILE EXISTS AT ALL. Until Phase 2 the student catalog read a
// hardcoded TypeScript array (`listeningContent.ts`) and never made a request,
// which is how five draft recordings appeared to a student while the backend
// correctly reported zero visible content. There was no leak to fix — there
// was no query. This module is the missing query.
//
// SEPARATE FROM listeningAdminService BY DESIGN, not by accident. That module
// talks to `/listening/manage/*` and returns rows carrying `isPublished`,
// `notes` and every draft in the system. This one talks to the two read-only
// student routes, whose responses are already filtered server-side by the
// canonical visibility predicate (content published AND category published).
// Merging them would put an admin-shaped type one property access away from a
// student page, which is exactly the mistake that makes client-side filtering
// look reasonable.
//
// THE CLIENT NEVER FILTERS FOR VISIBILITY. If a recording is in a response it
// is visible; if it is not, the student gets the same 404 as for an id that
// never existed. Anything the client could filter, it could also fail to
// filter.
//
// Both routes are GET and both are read-only. Nothing here starts a session,
// stamps a timestamp or records an attempt — the Sprint 07 bug where a GET
// created a quiz attempt is the reason that is stated rather than assumed.

export type { ListeningMediaProvider, ListeningMediaType, ListeningMode };

export interface ListeningCategoryRef {
  id: string;
  name: string;
  nameVi: string;
  orderIndex: number;
}

/** A catalog card. Carries counts, never transcripts. */
export interface ListeningCard {
  id: string;
  title: string;
  description: string | null;
  level: CefrLevel;
  thumbnailUrl: string | null;
  durationMs: number | null;
  segmentCount: number;
  supportedModes: ListeningMode[];
  sourceName: string | null;
  category: ListeningCategoryRef;
}

/**
 * A sentence, as the student is allowed to see it.
 *
 * `normalizedText` and `notes` are ABSENT, and their absence is load-bearing:
 * the backend builds this shape field by field precisely so the grading input
 * and the author's private notes cannot reach a browser. Do not add them here
 * "for convenience" — the type is the second half of that guarantee.
 */
export interface ListeningSegment {
  id: string;
  orderIndex: number;
  text: string;
  ipa: string | null;
  translationVi: string | null;
  startTimeMs: number;
  endTimeMs: number;
}

/**
 * Sprint 11 Phase 4A — one sentence's standing, as the SERVER computed it.
 *
 * Only sentences the student has attempted appear in the array this belongs
 * to. Absence IS "not started"; there is no row of zeroes, so the client must
 * never treat a missing entry as a failure to load.
 */
export interface DictationSegmentProgress {
  segmentId: string;
  completedAt: string | null;
  bestAccuracyPercent: number | null;
  attemptCount: number;
  assisted: boolean;
}

/**
 * A recording's Dictation standing, DERIVED server-side on every read.
 *
 * `completedSegments` is counted against the live sentence list at request
 * time and is stored nowhere. That is what lets an admin add a sentence to a
 * finished recording and have this correctly report in-progress again — so the
 * client must render these numbers, never recompute or cache them.
 */
export interface ListeningDictationSummary {
  totalSegments: number;
  completedSegments: number;
  completed: boolean;
  lastActivityAt: string | null;
}

export interface ListeningDictationProgress extends ListeningDictationSummary {
  segments: DictationSegmentProgress[];
}

export interface ListeningProgressSummary {
  contentId: string;
  /** Null when the recording does not enable DICTATION at all. */
  dictation: ListeningDictationSummary | null;
}

/**
 * A recording's Shadowing standing, DERIVED server-side on every read — the
 * Shadowing counterpart of ListeningDictationSummary. See
 * ShadowingSegmentProgress for why Dictation and Shadowing were never given a
 * shared progress shape.
 */
export interface ListeningShadowingSummary {
  totalSegments: number;
  completedSegments: number;
  completed: boolean;
  lastActivityAt: string | null;
}

export interface ListeningShadowingProgressSummary {
  contentId: string;
  /** Null when the recording does not enable SHADOWING at all. */
  shadowing: ListeningShadowingSummary | null;
}

export interface SubmitDictationAttemptResult {
  accuracyPercent: number;
  wordsCorrect: number;
  wordsTotal: number;
  solved: boolean;
  assisted: boolean;
  segment: DictationSegmentProgress;
  content: ListeningDictationSummary;
}

export interface ListeningContentDetail {
  id: string;
  title: string;
  description: string | null;
  level: CefrLevel;
  thumbnailUrl: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  mediaType: ListeningMediaType;
  mediaProvider: ListeningMediaProvider;
  mediaUrl: string;
  externalMediaId: string | null;
  durationMs: number | null;
  supportedModes: ListeningMode[];
  category: ListeningCategoryRef;
  segments: ListeningSegment[];
  /**
   * Sprint 11 Phase 4A. Null when the recording does not enable DICTATION.
   *
   * This is what makes a refresh mid-exercise lossless: the exercise rebuilds
   * "which sentences are done" from here rather than from anything it kept in
   * memory. Before Phase 4A there was nothing to rebuild from at all.
   */
  dictationProgress: ListeningDictationProgress | null;
  /** Sprint 11 Phase 4B. Null when the recording does not enable SHADOWING. */
  shadowingProgress: ShadowingSegmentProgress[] | null;
}

/* ── Shadowing (Phase 4B) ───────────────────────────────────────────────── */

/**
 * One sentence's shadowing standing.
 *
 * No `assisted`: speaking has no hint mechanism. The absence is the reason
 * Dictation and Shadowing were not given a shared progress shape.
 */
export interface ShadowingSegmentProgress {
  segmentId: string;
  completedAt: string | null;
  bestAccuracyPercent: number | null;
  attemptCount: number;
}

/**
 * One aligned word pair, produced ENTIRELY by the server.
 *
 * The client renders these and computes nothing from them. Deriving accuracy
 * in the browser from tokens the browser was handed would put grading back on
 * the client through the back door.
 */
export interface ShadowingAlignmentToken {
  op: 'MATCH' | 'SUBSTITUTE' | 'INSERT' | 'DELETE';
  reference: string | null;
  spoken: string | null;
  referenceIndex: number | null;
}

export interface SubmitShadowingAttemptResult {
  /** Raw engine output. Shown as-is, because the normalized form is not what the student said. */
  transcript: string;
  normalizedTranscript: string;
  alignment: ShadowingAlignmentToken[];
  accuracyPercent: number;
  wordsCorrect: number;
  wordsTotal: number;
  substitutions: number;
  insertions: number;
  deletions: number;
  passed: boolean;
  passThresholdPercent: number;
  segment: ShadowingSegmentProgress;
}

/**
 * Sprint 11 Phase 4C — AI pronunciation coaching for one attempt.
 *
 * NO NUMBER OF ANY KIND, and there is no field here for one. The attempt
 * already carries an accuracy computed from the alignment; a second figure
 * produced by a model that heard a single clip would be a fabricated
 * measurement standing next to a real one.
 *
 * `cached` is not a performance detail — it is the honest answer to "why does
 * it say exactly what it said last time".
 */
export interface ShadowingFeedbackResult {
  feedback: string;
  generatedAt: string;
  model: string;
  cached: boolean;
}

export interface ListeningCatalogResponse {
  data: ListeningCard[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  /**
   * Only categories that currently HAVE visible content, each with a real
   * count computed server-side from the same predicate the list uses.
   *
   * The catalog renders its filter chips from THIS array rather than from a
   * TypeScript union. The old seed catalog hardcoded six topic names and
   * counted them locally; a chip could therefore advertise a topic the server
   * would return nothing for.
   */
  categories: (ListeningCategoryRef & { contentCount: number })[];
}

export interface ListeningCatalogQuery {
  categoryId?: string;
  level?: CefrLevel;
  mode?: ListeningMode;
  q?: string;
  page?: number;
  limit?: number;
}

export const getListeningCatalog = async (
  query: ListeningCatalogQuery = {},
): Promise<ListeningCatalogResponse> => {
  const params = new URLSearchParams();
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.level) params.set('level', query.level);
  if (query.mode) params.set('mode', query.mode);
  if (query.q) params.set('q', query.q);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const search = params.toString();
  const response = await apiFetch(
    `${API_BASE_URL}/listening/catalog${search ? `?${search}` : ''}`,
  );
  if (!response.ok) {
    return throwApiError(response, 'Không tải được danh sách bài nghe');
  }
  return response.json();
};

/**
 * One recording with its sentences.
 *
 * A 404 here is deliberately ambiguous — missing id, draft recording, draft
 * category — so callers must not try to explain WHY to the student. Render one
 * not-found surface for all of them; anything more specific would turn this
 * endpoint into a way to discover unpublished ids.
 */
export const getListeningContent = async (
  contentId: string,
): Promise<ListeningContentDetail> => {
  const response = await apiFetch(
    `${API_BASE_URL}/listening/contents/${contentId}`,
  );
  if (!response.ok) {
    return throwApiError(response, 'Không tải được bài nghe');
  }
  return response.json();
};

/**
 * Submit one dictation attempt. THE ONLY WRITE IN THIS MODULE.
 *
 * Note what the body does NOT carry: no accuracy, no word counts, no `solved`.
 * The server grades from its own stored reference sentence and returns the
 * verdict — a client that computed its own would be deciding whether a student
 * passed, which is not a decision this app lets a browser make.
 *
 * `clientAttemptId` is the idempotency key, enforced by a unique constraint in
 * the database. Retrying a submission that already landed replays the original
 * result instead of creating a second attempt.
 */
export const submitDictationAttempt = async (
  segmentId: string,
  body: {
    clientAttemptId: string;
    typedText: string;
    revealedWordCount: number;
  },
): Promise<SubmitDictationAttemptResult> => {
  const response = await apiFetch(
    `${API_BASE_URL}/listening/segments/${segmentId}/dictation/attempts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    return throwApiError(response, 'Không lưu được kết quả bài nghe');
  }
  return response.json();
};

/**
 * Batch progress for a catalog page. Read-only, max 20 ids.
 *
 * Ids the student cannot see are ABSENT from the response rather than raising,
 * so one stale id never fails a whole page. Callers must therefore key by
 * `contentId` and treat a missing entry as "no progress", not as an error.
 */
export const getListeningProgress = async (
  contentIds: string[],
): Promise<ListeningProgressSummary[]> => {
  if (contentIds.length === 0) return [];
  const response = await apiFetch(
    `${API_BASE_URL}/listening/progress?contentIds=${encodeURIComponent(contentIds.join(','))}`,
  );
  if (!response.ok) {
    return throwApiError(response, 'Không tải được tiến độ bài nghe');
  }
  return response.json();
};

/**
 * Batch Shadowing progress for a catalog page. Read-only, max 20 ids — the
 * Shadowing counterpart of getListeningProgress, on its own route
 * (`/listening/shadowing/progress`) because `/listening/progress` already
 * belongs to Dictation.
 */
export const getListeningShadowingProgress = async (
  contentIds: string[],
): Promise<ListeningShadowingProgressSummary[]> => {
  if (contentIds.length === 0) return [];
  const response = await apiFetch(
    `${API_BASE_URL}/listening/shadowing/progress?contentIds=${encodeURIComponent(contentIds.join(','))}`,
  );
  if (!response.ok) {
    return throwApiError(response, 'Không tải được tiến độ luyện nhại');
  }
  return response.json();
};

/**
 * Submit one spoken attempt: upload the recording, get back a verdict.
 *
 * `FormData`, and NO `Content-Type` header — the browser must set it itself so
 * it can append the multipart boundary. Setting `multipart/form-data` by hand
 * produces a body the server cannot parse, and the symptom is a bare 400 with
 * nothing in it pointing at the header.
 *
 * The audio leaves the browser here and is not stored anywhere: the server
 * transcribes it inside one request and discards it. That is the product
 * decision this phase was approved on, and it is the only point in the app
 * where a student's voice is transmitted at all.
 */
export const submitShadowingAttempt = async (
  segmentId: string,
  body: { clientAttemptId: string; audio: Blob; durationMs?: number },
): Promise<SubmitShadowingAttemptResult> => {
  const form = new FormData();
  form.append('clientAttemptId', body.clientAttemptId);
  if (body.durationMs !== undefined) {
    form.append('durationMs', String(Math.round(body.durationMs)));
  }
  // A filename is required for the server to see this as a file part at all.
  // The extension is cosmetic — the server reads the blob's MIME type.
  form.append('audio', body.audio, 'attempt');

  const response = await apiFetch(
    `${API_BASE_URL}/listening/segments/${segmentId}/shadowing/attempts`,
    { method: 'POST', body: form },
  );
  if (!response.ok) {
    return throwApiError(response, 'Không chấm được bài nói');
  }
  return response.json();
};

/**
 * Sprint 11 Phase 4C — ask for AI coaching on an attempt already graded.
 *
 * THE RECORDING IS SENT AGAIN, because nothing kept it. The server discarded
 * the audio inside the submit request by design, so re-uploading is the honest
 * cost of that decision — the alternative is a stored copy of the student's
 * voice waiting in case they press a button, which is exactly what Shadowing
 * refused to build.
 *
 * `clientAttemptId` is the SAME key the attempt was submitted under. That is
 * what lets the server find the sentence and transcript in its own row, and
 * what makes a second press return the first answer instead of paying for a
 * second opinion that disagrees with it.
 */
export const requestShadowingFeedback = async (
  segmentId: string,
  body: { clientAttemptId: string; audio: Blob },
): Promise<ShadowingFeedbackResult> => {
  const form = new FormData();
  form.append('clientAttemptId', body.clientAttemptId);
  form.append('audio', body.audio, 'attempt');

  const response = await apiFetch(
    `${API_BASE_URL}/listening/segments/${segmentId}/shadowing/feedback`,
    { method: 'POST', body: form },
  );
  if (!response.ok) {
    return throwApiError(response, 'Không lấy được nhận xét của AI');
  }
  return response.json();
};
