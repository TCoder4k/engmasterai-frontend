import React from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { Lesson } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface LessonListItemProps {
  courseId: string;
  lesson: Lesson;
  orderNumber: number;
}

const LessonListItem: React.FC<LessonListItemProps> = ({ courseId, lesson, orderNumber }) => {
  const { t } = useTranslation();
  return (
    <Link
      to={`/courses/${courseId}/lessons/${lesson.id}`}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md dark:shadow-none dark:border dark:border-slate-800 dark:hover:border-slate-700 p-4 sm:p-5 flex items-center gap-4 transition-all duration-200"
    >
      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 text-sm font-extrabold">
        {orderNumber}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100 truncate">{lesson.title}</h3>
        {lesson.estimatedStudyMinutes && (
          <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            {lesson.estimatedStudyMinutes} {t.lesson.minutesUnit}
          </p>
        )}
      </div>
      <PlayCircle size={20} className="text-slate-300 dark:text-slate-600 flex-shrink-0" aria-hidden="true" />
    </Link>
  );
};

export default LessonListItem;
