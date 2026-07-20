// Client-side "Continue Learning" ring buffer (Student Learning Experience
// design §5). Keyed per-user so a shared device never surfaces one
// student's recent activity under a different account. Callers pass the
// userId explicitly (from authService.getUser()) rather than this module
// importing authService itself, keeping the storage helper and the auth
// service decoupled in both directions.

export type RecentActivityType = 'lesson' | 'course' | 'deck' | 'practice';

export interface RecentActivityEntry {
  type: RecentActivityType;
  id: string;
  title: string;
  // Already-resolved deep link, written once at record time by the page
  // that has every parent id in scope (e.g. a Lesson's route needs both
  // courseId and lessonId) — never re-derived from a bare id later.
  path: string;
  openedAt: string;
}

const MAX_ENTRIES = 10;
const keyFor = (userId: string) => `recentActivity:${userId}`;

export function getRecentActivity(userId: string): RecentActivityEntry[] {
  const raw = localStorage.getItem(keyFor(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getMostRecentActivity(userId: string): RecentActivityEntry | null {
  return getRecentActivity(userId)[0] ?? null;
}

// Writes (or moves-to-front) one entry, deduplicated by { type, id } so
// re-opening the same lesson/course/deck updates its timestamp instead of
// duplicating it.
export function recordRecentActivity(
  userId: string,
  entry: Omit<RecentActivityEntry, 'openedAt'>,
): void {
  const existing = getRecentActivity(userId).filter(
    (item) => !(item.type === entry.type && item.id === entry.id),
  );
  const next: RecentActivityEntry[] = [
    { ...entry, openedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_ENTRIES);
  localStorage.setItem(keyFor(userId), JSON.stringify(next));
}

// Called on logout so this student's recent activity never leaks into a
// different account's dashboard on a shared/school device.
export function clearRecentActivity(userId: string): void {
  localStorage.removeItem(keyFor(userId));
}
