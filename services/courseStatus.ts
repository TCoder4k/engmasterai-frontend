import { TranslationDict } from '../i18n/translations';
import { CourseStatus, LessonStatus } from './courseProgressService';

// Sprint 08 — the ONE place a progress status becomes a badge and a button.
//
// Six components render one of these (lesson rows, course cards on three
// pages, the course hero, Continue Learning). Before this file, one of them
// rendered a hardcoded "Bắt đầu" on every row no matter what the student had
// done, and the rest showed nothing at all. Six independent mappings is six
// chances to disagree about what "Đang học dở" means.
//
// THE CTA IS CHOSEN BY STATUS, NOT BY PERCENTAGE. It is tempting to map
// 0% -> start, 1-99% -> continue, 100% -> review, and it is wrong: a student
// half-way through the first lesson of five has completed zero lessons and
// sits at 0%, but they have a place to return to. Offering them "Bắt đầu"
// discards it. Status knows the difference; a percentage does not.

// While the request is in flight, and after it failed. Both are rendered
// explicitly and neither may fall back to NOT_STARTED — showing "Sẵn sàng
// học" for a course the student has half finished is a lie the UI tells
// while it waits, and on failure it is a lie it never takes back.
export type ProgressViewState = 'loading' | 'error';

export type LessonRowState = LessonStatus | ProgressViewState;
export type CourseCardState = CourseStatus | ProgressViewState;

export interface StatusPresentation {
  label: string;
  cta: string;
  // Tailwind classes for the badge. Kept beside the label so a status cannot
  // be given the wrong colour in one component and the right one in another.
  badgeClass: string;
  // Whether the row/card should read as actionable. NO_CONTENT and the two
  // view states are not.
  actionable: boolean;
}

const NEUTRAL =
  'bg-slate-50 text-slate-500 border-slate-200 dark:bg-ink-950 dark:text-slate-400 dark:border-ink-700';
const AMBER =
  'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/40';
const EMERALD =
  'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/40';
const ROSE =
  'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/40';

export const statusPresentation = (
  state: LessonRowState | CourseCardState,
  t: TranslationDict,
): StatusPresentation => {
  switch (state) {
    case 'COMPLETED':
      return {
        label: t.course.statusCompleted,
        cta: t.course.ctaReview,
        badgeClass: EMERALD,
        actionable: true,
      };
    case 'IN_PROGRESS':
      return {
        label: t.course.statusInProgress,
        cta: t.course.ctaContinue,
        badgeClass: AMBER,
        actionable: true,
      };
    case 'NOT_STARTED':
      return {
        label: t.course.statusNotStarted,
        cta: t.course.ctaStart,
        badgeClass: NEUTRAL,
        actionable: true,
      };
    case 'NO_CONTENT':
      return {
        label: t.course.statusNoContent,
        cta: t.course.ctaUnavailable,
        badgeClass: NEUTRAL,
        actionable: false,
      };
    case 'error':
      return {
        label: t.course.progressLoadFailed,
        cta: t.course.retryProgress,
        badgeClass: ROSE,
        actionable: false,
      };
    case 'loading':
      return {
        label: t.common.loading,
        cta: t.common.loading,
        badgeClass: NEUTRAL,
        actionable: false,
      };
  }
};

// Resolves what a row should render from the three things a page knows: has
// the request finished, did it fail, and did the server mention this lesson.
//
// A lesson the server did NOT mention renders NOT_STARTED, not an error. That
// is the honest reading: the lessons list and the progress request are two
// independent calls, so a lesson published between them appears in one and not
// the other — and a lesson that new genuinely has not been started.
export const resolveLessonRowState = (
  progressState: 'loading' | 'ready' | 'error',
  status: LessonStatus | undefined,
): LessonRowState => {
  if (progressState === 'loading') return 'loading';
  if (progressState === 'error') return 'error';
  return status ?? 'NOT_STARTED';
};
