import { CefrLevel } from '../types';
import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Speaking Partner (Phase 1+2) — the STUDENT API surface.
//
// SEPARATE FROM listeningService/chatService BY DESIGN, not by accident —
// this is its own domain (see speaking.module.ts's own header). Reuses the
// SAME discipline listeningService already established: the client never
// filters for visibility (a missing scenario/exercise is a 404, not a
// client-side hide), and nothing here computes or asserts correctness —
// transcript and AI reply are exactly what the server returns.
//
// THE STUDENT-FACING EXERCISE SHAPE HAS NO aiRole/conversationGoal/targetTurns
// — mirrors the backend's SpeakingExerciseStudentView exactly. Do not widen
// this type "for convenience"; the backend never sends those fields to a
// student route, so a wider type here would just be permanently unfillable.

export interface SpeakingScenarioCard {
  id: string;
  name: string;
  nameVi: string;
  description: string | null;
  /** Vietnamese translation of `description` (2026-08-20) — see the backend schema comment on SpeakingScenario.descriptionVi. */
  descriptionVi: string | null;
  level: CefrLevel | null;
  orderIndex: number;
  exerciseCount: number;
  /** True for the one open-topic "Free Talk" scenario — rendered in its own catalog section. */
  isFreeTalk: boolean;
}

export interface SpeakingExerciseStudentView {
  id: string;
  title: string;
  titleVi: string;
  description: string;
  /** Vietnamese translation of `description` (2026-08-20) — see the backend schema comment on SpeakingExercise.descriptionVi. */
  descriptionVi: string;
  level: CefrLevel;
  openingLine: string;
}

export interface SpeakingScenarioDetail {
  id: string;
  name: string;
  nameVi: string;
  description: string | null;
  descriptionVi: string | null;
  level: CefrLevel | null;
  exercises: SpeakingExerciseStudentView[];
  isFreeTalk: boolean;
}

export interface SpeakingAttemptStart {
  attemptId: string;
  exerciseId: string;
  startedAt: string;
  openingLine: string;
  exercise: {
    title: string;
    titleVi: string;
    level: CefrLevel;
    description: string;
    descriptionVi: string;
  };
  /**
   * Single-use, short-lived credential for opening the Speaking Live
   * WebSocket (services/speakingLiveSocket.ts) for THIS attempt — never the
   * access JWT itself. See speaking-live-ticket.store.ts's backend header
   * for why.
   */
  liveTicket: string;
}

/** No `durationSeconds` — deliberately not persisted, see the backend schema comment on SpeakingAttempt. */
export interface SpeakingAttemptSummary {
  attemptId: string;
  exerciseId: string;
  startedAt: string;
  completedAt: string;
  turnCount: number;
}

export const getSpeakingScenarios = async (): Promise<SpeakingScenarioCard[]> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/scenarios`);
  if (!response.ok) {
    return throwApiError(response, 'Không tải được danh sách chủ đề luyện nói');
  }
  return response.json();
};

/** A 404 here is deliberately ambiguous — missing id or draft scenario. Render one not-found surface for both. */
export const getSpeakingScenario = async (
  scenarioId: string,
): Promise<SpeakingScenarioDetail> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/scenarios/${scenarioId}`);
  if (!response.ok) {
    return throwApiError(response, 'Không tải được chủ đề luyện nói');
  }
  return response.json();
};

/** Starts a new attempt. No audio, no Gemini call — the opening line is authored content. */
export const startSpeakingAttempt = async (
  exerciseId: string,
): Promise<SpeakingAttemptStart> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/exercises/${exerciseId}/attempts`, {
    method: 'POST',
  });
  if (!response.ok) {
    return throwApiError(response, 'Không thể bắt đầu bài luyện nói');
  }
  return response.json();
};

/** Idempotent — a second call on an already-completed attempt returns the same result. */
export const completeSpeakingAttempt = async (
  attemptId: string,
): Promise<SpeakingAttemptSummary> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/attempts/${attemptId}/complete`, {
    method: 'POST',
  });
  if (!response.ok) {
    return throwApiError(response, 'Không thể kết thúc bài luyện nói');
  }
  return response.json();
};

/**
 * On-demand subtitle translation — only called when a student actually
 * opens the "Bật phụ đề" toggle for a given AI message. Stateless: no
 * attempt/exercise scoping. A failure here must never affect the
 * conversation itself — callers render it as a local, per-message state,
 * never as a page-level error.
 */
export const translateSpeakingText = async (text: string): Promise<{ textVi: string }> => {
  const response = await apiFetch(`${API_BASE_URL}/speaking/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    return throwApiError(response, 'Không dịch được câu này');
  }
  return response.json();
};
