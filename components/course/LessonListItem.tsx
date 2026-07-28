import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Play } from 'lucide-react';
import { Lesson } from '../../types';
import { authService } from '../../services/authService';
import { isLessonComplete, isLessonStarted, QuizStageProgress } from '../../services/lessonProgress';
import { useTranslation } from '../../i18n/useTranslation';

interface LessonListItemProps {
  courseId: string;
  lesson: Lesson;
  orderNumber: number;
  // Sprint 06B — server-side quiz progress for THIS lesson, fetched once by
  // CourseDetailPage via quizService.getCourseQuizProgress and passed down.
  // Undefined for a lesson with no quiz, or while quiz progress hasn't
  // loaded yet — isLessonComplete already treats that as "not complete"
  // rather than fabricating a status.
  quizProgress?: QuizStageProgress;
}

// Row anatomy follows the design reference's lesson stack (status badge ->
// meta line -> title -> right-hand action).
//
// The reference's per-lesson accuracy badge ("Đã hoàn thành — 95% chính
// xác") is NOT reproduced: accuracy needs LessonTask/Question, which has no
// API. The completion badge here is real but device-local, and it means
// every stage the lesson offers is finished — not merely that the video
// played to the end.
const LessonListItem: React.FC<LessonListItemProps> = ({ courseId, lesson, orderNumber, quizProgress }) => {
  const { t } = useTranslation();
  const userId = authService.getUser()?.id;

  const completed = isLessonComplete(userId, lesson, quizProgress);
  const started = !completed && isLessonStarted(userId, lesson, quizProgress);

  const badgeClass = completed
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/40'
    : started
      ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/40'
      : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-ink-950 dark:text-slate-400 dark:border-ink-700';

  const statusLabel = completed
    ? t.lesson.stageCompleted
    : started
      ? t.lesson.stageInProgress
      : t.lesson.stageNotStarted;

  return (
    <Link
      to={`/courses/${courseId}/lessons/${lesson.id}`}
      className={`group bg-white dark:bg-ink-900 rounded-2xl border shadow-sm hover:shadow-md dark:hover:shadow-indigo-500/10 p-4 sm:p-5 flex items-center gap-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        completed
          ? 'border-emerald-200/70 dark:border-emerald-500/30'
          : started
            ? 'border-amber-200/70 dark:border-amber-500/30'
            : 'border-slate-100 dark:border-ink-700 hover:border-indigo-200 dark:hover:border-indigo-500/50'
      }`}
    >
      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-black border ${badgeClass}`}
      >
        {completed ? <CheckCircle2 size={20} aria-hidden="true" /> : orderNumber}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {t.lesson.lessonLabel} {orderNumber}
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
            {statusLabel}
          </span>
          {lesson.estimatedStudyMinutes && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              <Clock size={11} aria-hidden="true" />
              {lesson.estimatedStudyMinutes} {t.lesson.minutesUnit}
            </span>
          )}
        </div>

        <h4 className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
          {lesson.title}
        </h4>
        {lesson.description && (
          <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
            {lesson.description}
          </p>
        )}
      </div>

      <span
        className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-extrabold flex-shrink-0 shadow-lg shadow-indigo-500/20 transition-all group-hover:from-indigo-500 group-hover:to-violet-500"
        aria-hidden="true"
      >
        <Play size={13} className="fill-current" />
        <span>{t.course.startLesson}</span>
      </span>

      <Play
        size={20}
        className="sm:hidden text-indigo-500 dark:text-indigo-400 fill-current flex-shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
};

export default LessonListItem;
