import { apiFetch } from './apiFetch';
import { throwApiError } from './apiError';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 10.5 — POST /study-time/heartbeat, the NORMAL (foreground) path.
//
// This one goes through apiFetch like every other authenticated call, so it
// gets the shared bearer header and the single-flight refresh on 401. That is
// correct here and only here: the document is alive, a refresh can complete,
// and its rotated token will be persisted for the next request.
//
// The page-unload path is deliberately a DIFFERENT module (studyTimeBeacon.ts)
// with none of that. See the note there — it is the more important half of this
// pair.
//
// NOTHING IS PUBLISHED FROM HERE. Study time awards no XP, so there is no
// gamification envelope to fan out; adding one would be inventing a reward the
// backend does not grant.

export type StudyActivityType =
  | 'VIDEO'
  | 'THEORY'
  | 'QUIZ'
  | 'PRACTICE'
  | 'TRAP_HUNTER'
  | 'SRS_REVIEW'
  | 'VOCAB_PRACTICE'
  | 'LISTENING';

export interface StudyHeartbeatBody {
  clientSessionId: string;
  sequence: number;
  activityType: StudyActivityType;
  activityId?: string;
  activeSeconds: number;
}

export interface StudyHeartbeatResponse {
  /**
   * Seconds the SERVER decided to credit — never assumed to equal what was
   * sent. It is 0 for a replay and for a day that has reached its ceiling, and
   * the client must not "correct" either case.
   */
  acceptedSeconds: number;
}

export const postStudyHeartbeat = async (
  body: StudyHeartbeatBody,
): Promise<StudyHeartbeatResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/study-time/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return throwApiError(response, 'Failed to record study time');
  }
  return response.json();
};
