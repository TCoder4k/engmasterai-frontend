// In-memory (module-scoped) record of listening activity for the CURRENT
// browser session only (Sprint 03E). Deliberately NOT localStorage: no
// persisted-progress backend exists, and the honest-data rule forbids
// implying saved progress — a page refresh clears this by construction,
// which is exactly the promised behavior ("after refresh, do not claim
// progress was saved"). The catalog's "Continue Learning" section renders
// only from entries recorded here.

export interface ListeningSessionRecord {
  lessonId: string;
  lastSegmentIndex: number;
  solvedSegmentIds: number[];
  assistedSegmentIds: number[];
  totalSegments: number;
  updatedAt: number;
}

const records = new Map<string, ListeningSessionRecord>();

export const recordListeningSession = (record: ListeningSessionRecord): void => {
  records.set(record.lessonId, record);
};

export const getListeningSession = (lessonId: string): ListeningSessionRecord | undefined =>
  records.get(lessonId);

// Most-recently-touched first — for the catalog's Continue section.
export const getActiveListeningSessions = (): ListeningSessionRecord[] =>
  [...records.values()]
    .filter((r) => r.solvedSegmentIds.length > 0 || r.lastSegmentIndex > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);

// Test hook — module-scoped state would otherwise leak between tests.
export const clearListeningSessions = (): void => {
  records.clear();
};
