import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 08 — the canonical course-progress read, and the only one.
//
// Before this, every course surface fetched raw per-stage rows and rolled them
// up itself with services/lessonProgress.ts. Sprint 07 had already made the
// INPUTS server-authoritative, but the RULE was still the browser's, so a
// percentage was something the client decided. The server decides now; this
// module only carries the answer across the wire.
//
// It is also what removes a client-side N+1: GrammarRoadmapPage issued two
// requests per course, so a twelve-course roadmap cost 24 round trips. One
// batch request replaces all of them.

// Mirrors the backend LessonStatus. NO_CONTENT is the fourth value and it is
// load-bearing: a lesson published with only audioUrl offers no completable
// stage at all (there is no audio stage), so it is excluded from the course
// totals rather than sitting at NOT_STARTED and making 100% unreachable.
export type LessonStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_CONTENT';

export type CourseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface CourseLessonStatus {
  lessonId: string;
  orderIndex: number;
  status: LessonStatus;
}

export interface CourseProgressSummary {
  courseId: string;
  // EXCLUDES NO_CONTENT lessons, so a course holding one can still reach 100%.
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  notStartedLessons: number;
  progressPercent: number;
  status: CourseStatus;
  // An ID, never a path — no backend endpoint emits frontend routes, and
  // starting now would make a React Router change a backend redeploy.
  // Compose the route with continuePath() below.
  continueLessonId: string | null;
  // Present only when `includeLessons` was asked for.
  lessons: CourseLessonStatus[] | null;
}

// GET /progress/courses?courseIds=a,b,c
//
// Returns a Map keyed by courseId because every caller immediately needs to
// look up one course at a time. Courses that are unpublished or unknown are
// simply ABSENT from the map — the server omits them rather than failing the
// whole batch, so one stale id cannot blank an entire catalog page.
export const getCourseProgressSummaries = async (
  courseIds: string[],
  options: { includeLessons?: boolean } = {},
): Promise<Map<string, CourseProgressSummary>> => {
  // The server rejects an empty list with a 400, and rightly so, but a page
  // that has not loaded its courses yet should not make the request at all.
  if (courseIds.length === 0) return new Map();

  const params = new URLSearchParams({ courseIds: courseIds.join(',') });
  if (options.includeLessons) params.set('include', 'lessons');

  const response = await apiFetch(`${API_BASE_URL}/progress/courses?${params}`);
  if (!response.ok) return throwApiError(response, 'Failed to load course progress');

  const rows: CourseProgressSummary[] = await response.json();
  return new Map(rows.map((row) => [row.courseId, row]));
};

// The route "Học tiếp" and "Ôn tập lại" both lead to. Composed here rather
// than on the server: routing is the client's business, and one helper means
// five components cannot spell the path five ways.
export const continuePath = (
  summary: Pick<CourseProgressSummary, 'courseId' | 'continueLessonId'>,
): string | null =>
  summary.continueLessonId
    ? `/courses/${summary.courseId}/lessons/${summary.continueLessonId}`
    : null;
