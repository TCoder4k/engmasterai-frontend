import { newUuidV4 } from './clientSessionId';

// Sprint 10.5 — the (clientSessionId, sequence) pair that forms the server's
// idempotency key, and the rule for retiring one.
//
// EXTRACTED SO THE ROTATION IS TESTABLE. Rotation happens once every 1,440
// heartbeats — a full day on one open tab. Proving it inside the boundary would
// mean driving 1,440 timer ticks; proving it here is three assertions. Same
// reasoning as creditableSeconds.ts on the backend: a rule that only fires at a
// boundary needs to be reachable without reproducing the journey to it.

/** Mirror of the backend's MAX_SEQUENCE (@Max on StudyHeartbeatDto.sequence). */
export const MAX_SEQUENCE = 1440;

export interface StudySessionIdentity {
  clientSessionId: string;
  sequence: number;
}

export const newStudySessionIdentity = (): StudySessionIdentity => ({
  clientSessionId: newUuidV4(),
  sequence: 0,
});

/**
 * Return the identity to send with the NEXT heartbeat, rotating first if this
 * session has no room left.
 *
 * Rotates BEFORE the ceiling, never on hitting it. Letting `sequence` reach
 * MAX_SEQUENCE would make every subsequent heartbeat a 400, and a heartbeat has
 * no UI — the student would simply stop being credited with nothing to report
 * and nothing on screen to explain it.
 */
export const rotateIfExhausted = (
  identity: StudySessionIdentity,
): StudySessionIdentity =>
  identity.sequence >= MAX_SEQUENCE - 1 ? newStudySessionIdentity() : identity;
