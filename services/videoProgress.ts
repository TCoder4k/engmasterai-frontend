// Local, per-user, per-lesson YouTube video resume state (Student Learning
// Experience design §7.4.3). Device-local only — no cross-device sync is
// implied or attempted. Keyed per-user for the same shared-device privacy
// reason as recentActivity.ts; callers pass userId explicitly rather than
// this module importing authService.

export interface VideoProgressEntry {
  courseId: string;
  resolvedLessonPath: string;
  youtubeVideoId: string;
  positionSeconds: number;
  durationSeconds: number;
  lastUpdatedAt: string;
  ended: boolean;
}

const keyFor = (userId: string, lessonId: string) => `videoProgress:${userId}:${lessonId}`;

export function getVideoProgress(userId: string, lessonId: string): VideoProgressEntry | null {
  const raw = localStorage.getItem(keyFor(userId, lessonId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VideoProgressEntry;
  } catch {
    return null;
  }
}

export function saveVideoProgress(userId: string, lessonId: string, entry: VideoProgressEntry): void {
  localStorage.setItem(keyFor(userId, lessonId), JSON.stringify(entry));
}

// Called on logout so a shared device never resumes one student's video
// position under a different account.
export function clearAllVideoProgress(userId: string): void {
  const prefix = `videoProgress:${userId}:`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) localStorage.removeItem(key);
  }
}
