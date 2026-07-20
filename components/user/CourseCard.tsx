import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BookMarked, Headphones } from 'lucide-react';
import { Course } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface CourseCardProps {
  course: Course;
}

// Per-type chip/tile styling for the "Recommended for You" card design.
// Labels come from the shared track translations (single source with the
// Learning Tracks section).
const TYPE_STYLES: Record<
  Course['type'],
  { key: 'grammar' | 'vocabulary' | 'listening'; chipClass: string; tileClass: string; icon: React.ReactNode }
> = {
  GRAMMAR: {
    key: 'grammar',
    chipClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    tileClass: 'bg-indigo-100 text-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-400',
    icon: <BookOpen size={28} />,
  },
  VOCABULARY: {
    key: 'vocabulary',
    chipClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    tileClass: 'bg-emerald-100 text-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-400',
    icon: <BookMarked size={28} />,
  },
  LISTENING: {
    key: 'listening',
    chipClass: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
    tileClass: 'bg-sky-100 text-sky-400 dark:bg-sky-500/15 dark:text-sky-400',
    icon: <Headphones size={28} />,
  },
};

// Now a real link into Course Detail (/courses/:id) — the student Lesson
// flow exists (Student Learning Experience design, Sprint 1), so this is
// no longer a dead action.
const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const { t } = useTranslation();
  const style = TYPE_STYLES[course.type];

  return (
    <Link
      to={`/courses/${course.id}`}
      className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 hover:shadow-md transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <div className="flex items-start justify-between space-x-4">
        <div className="min-w-0">
          <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-md ${style.chipClass}`}>
            {t.tracks[style.key].label}
          </span>
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100 mt-2.5 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {course.title}
          </h3>
        </div>
        <div
          className={`w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 ${
            course.thumbnail ? '' : style.tileClass
          }`}
          aria-hidden={course.thumbnail ? undefined : 'true'}
        >
          {course.thumbnail ? (
            <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            style.icon
          )}
        </div>
      </div>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-3 leading-relaxed line-clamp-2">
        {course.description}
      </p>
    </Link>
  );
};

export default CourseCard;
