import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star } from 'lucide-react';
import { Course } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { mockRatingFor } from './dashboardContent';

interface CourseCardProps {
  course: Course;
}

// "Recommended for You" card, restyled to the design reference: a type chip,
// the title, a real meta line, and a footer pairing the rating with a chevron.
//
// The lesson count in the meta line is REAL (`_count.lessons`, the same
// figure Course Detail shows). The star rating is NOT — no rating feature
// exists anywhere in this product; see dashboardContent.ts.
const TYPE_STYLES: Record<
  Course['type'],
  { key: 'grammar' | 'vocabulary' | 'listening'; chipClass: string; hoverBorder: string; hoverText: string }
> = {
  GRAMMAR: {
    key: 'grammar',
    chipClass:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
    hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-500/50',
    hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-300',
  },
  VOCABULARY: {
    key: 'vocabulary',
    chipClass:
      'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
    hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-500/50',
    hoverText: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-300',
  },
  LISTENING: {
    key: 'listening',
    chipClass:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500/50',
    hoverText: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-300',
  },
};

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const { t } = useTranslation();
  const style = TYPE_STYLES[course.type];
  const rating = mockRatingFor(course.id);
  const lessonCount = course._count?.lessons ?? 0;

  return (
    <Link
      to={`/courses/${course.id}`}
      className={`group flex flex-col justify-between gap-3 p-4 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${style.hoverBorder}`}
    >
      <div className="space-y-1 min-w-0">
        <span
          className={`inline-block px-2 py-0.5 border text-[10px] font-bold rounded ${style.chipClass}`}
        >
          {t.tracks[style.key].label}
        </span>
        <h3
          className={`text-sm font-bold text-slate-900 dark:text-white transition-colors ${style.hoverText}`}
        >
          {course.title}
        </h3>
        {/* Real figure, and only when there is one. */}
        {lessonCount > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {lessonCount} {t.widgets.lessons}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-ink-700 text-[11px] font-bold">
        <span
          className="flex items-center gap-1 text-amber-500 dark:text-amber-400"
          title={t.widgets.sampleData}
        >
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
          {rating.score} ({rating.count})
        </span>
        <ChevronRight
          className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
};

export default CourseCard;
