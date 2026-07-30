import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Play, RotateCcw } from 'lucide-react';
import { Lesson } from '../../types';
import { LessonRowState, statusPresentation } from '../../services/courseStatus';
import { useTranslation } from '../../i18n/useTranslation';

interface LessonListItemProps {
  courseId: string;
  lesson: Lesson;
  orderNumber: number;
  // Sprint 08 — the SERVER's status for this lesson, plus the two view states
  // that are not statuses at all.
  //
  // This replaced a `progress` snapshot that the row rolled up itself through
  // isLessonComplete(). Sprint 07 had already made the inputs server-side, but
  // the rule was still here, so the course page and the lesson page each
  // computed completion from their own copy. There is one copy now, and it is
  // not in the browser.
  state: LessonRowState;
}

// Row anatomy follows the design reference's lesson stack (status badge ->
// meta line -> title -> right-hand action).
//
// The reference's per-lesson accuracy badge ("Đã hoàn thành — 95% chính xác")
// is NOT reproduced: it needs a per-lesson accuracy figure the course
// aggregate does not carry.
const LessonListItem: React.FC<LessonListItemProps> = ({
  courseId,
  lesson,
  orderNumber,
  state,
}) => {
  const { t } = useTranslation();
  const presentation = statusPresentation(state, t);

  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isCompleted = state === 'COMPLETED';
  // A lesson with no completable stage is still reachable — the student may
  // want to look at it — but it is never presented as progress they owe.
  const isNoContent = state === 'NO_CONTENT';

  const borderClass = isCompleted
    ? 'border-emerald-200/70 dark:border-emerald-500/30'
    : state === 'IN_PROGRESS'
      ? 'border-amber-200/70 dark:border-amber-500/30'
      : 'border-slate-100 dark:border-ink-700 hover:border-blue-200 dark:hover:border-blue-500/50';

  const ctaIcon = isCompleted ? (
    <RotateCcw size={13} />
  ) : isError ? (
    <AlertCircle size={13} />
  ) : (
    <Play size={13} className="fill-current" />
  );

  return (
    <Link
      to={`/courses/${courseId}/lessons/${lesson.id}`}
      className={`group bg-white dark:bg-ink-900 rounded-2xl border shadow-sm hover:shadow-md dark:hover:shadow-blue-500/10 p-4 sm:p-5 flex items-center gap-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${borderClass}`}
    >
      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-black border ${presentation.badgeClass}`}
      >
        {isCompleted ? <CheckCircle2 size={20} aria-hidden="true" /> : orderNumber}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {t.lesson.lessonLabel} {orderNumber}
          </span>

          {/* While progress is in flight the badge is a skeleton, never a
              status. Rendering "Sẵn sàng học" here and correcting it a moment
              later is the flash this sprint exists to remove — and for a
              student who has finished the lesson, it is simply wrong. */}
          {isLoading ? (
            <span
              className="h-[17px] w-20 rounded bg-slate-100 dark:bg-ink-800 animate-pulse"
              aria-label={t.common.loading}
            />
          ) : (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${presentation.badgeClass}`}
            >
              {presentation.label}
            </span>
          )}

          {lesson.estimatedStudyMinutes && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              <Clock size={11} aria-hidden="true" />
              {lesson.estimatedStudyMinutes} {t.lesson.minutesUnit}
            </span>
          )}
        </div>

        <h4 className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
          {lesson.title}
        </h4>
        {lesson.description && (
          <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
            {lesson.description}
          </p>
        )}
      </div>

      {/* The CTA follows the same rule as the badge: no status, no claim.
          Loading shows a skeleton; a failed fetch says so rather than
          inviting the student to "start" something they may have finished. */}
      {isLoading ? (
        <span
          className="hidden sm:inline-flex h-10 w-28 rounded-xl bg-slate-100 dark:bg-ink-800 animate-pulse flex-shrink-0"
          aria-hidden="true"
        />
      ) : (
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold flex-shrink-0 transition-all ${
            isError || isNoContent
              ? 'bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 group-hover:from-blue-500 group-hover:to-indigo-500'
          }`}
          aria-hidden="true"
        >
          {ctaIcon}
          <span>{presentation.cta}</span>
        </span>
      )}

      <Play
        size={20}
        className="sm:hidden text-blue-500 dark:text-blue-400 fill-current flex-shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
};

export default LessonListItem;
