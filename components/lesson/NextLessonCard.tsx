import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Lesson } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface NextLessonCardProps {
  courseId: string;
  currentLesson: Lesson;
  allLessons: Lesson[];
}

// Pure client computation over the already-fetched, orderIndex-sorted
// lesson list (design doc §6.8) — no new endpoint. Never a dead link: the
// last lesson in a course shows a "course complete" state instead of a
// broken "Next Lesson" link (Principle #9).
const NextLessonCard: React.FC<NextLessonCardProps> = ({ courseId, currentLesson, allLessons }) => {
  const { t } = useTranslation();
  const sorted = [...allLessons].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentIndex = sorted.findIndex((lesson) => lesson.id === currentLesson.id);
  const next = currentIndex >= 0 ? sorted[currentIndex + 1] : undefined;

  if (next) {
    return (
      <Link
        to={`/courses/${courseId}/lessons/${next.id}`}
        className="flex items-center justify-between bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-6 py-5 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-200">{t.lesson.nextLesson}</p>
          <p className="text-[16px] font-extrabold mt-1 truncate">{next.title}</p>
        </div>
        <ArrowRight size={20} className="flex-shrink-0 ml-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl px-6 py-5">
      <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 min-w-0 text-[15px] font-extrabold text-emerald-700 dark:text-emerald-300">
        {t.lesson.courseComplete}
      </p>
      <Link
        to={`/courses/${courseId}`}
        className="text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex-shrink-0"
      >
        {t.lesson.backToCourse}
      </Link>
    </div>
  );
};

export default NextLessonCard;
