// UI-only types for the Practice feature (Sprint 03A+). These are NOT the
// future SRS domain types — once Vocabulary Phase 3 (SRS backend) ships,
// persisted rating/review types will be authored separately to mirror the
// backend DTOs exactly, per the migration plan's Decisions log.

export type VocabPracticeMode = 'flashcard' | 'dictation' | 'games' | 'contextual';

// A session's outcome, held in memory only for the lifetime of the page —
// never persisted, never labeled as anything other than "this session."
export interface SessionResult {
  totalCards: number;
  correctCount: number;
}
