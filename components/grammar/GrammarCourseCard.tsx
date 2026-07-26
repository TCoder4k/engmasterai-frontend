import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, ChevronRight, Clock, Layers } from 'lucide-react';
import { Course, Lesson } from '../../types';
import { GrammarCategory, deriveCourseLevel, deriveGrammarCategory } from './grammarCategory';
import { CourseProgress } from '../../services/lessonProgress';
import { useTranslation } from '../../i18n/useTranslation';

interface GrammarCourseCardProps {
  course: Course;
  // Published lessons for this course, fetched by the roadmap page. `null`
  // while that request is still in flight or after it failed — the card then
  // renders without duration or progress rather than guessing either.
  lessons: Lesson[] | null;
  progress: CourseProgress | null;
}

// Card anatomy follows the AI Studio reference (thumbnail band -> badge row
// -> title -> description -> meta row -> progress -> CTA), re-authored in
// the production design system so it works in both themes.
//
// Deliberately NOT reproduced from the reference, because each is mock data
// there with no field behind it here: tag chips (#TOEIC Part 5), the author
// line, the XP reward, and a "Hoàn thành" ribbon driven by fake completion.
// The progress bar below IS real — see services/lessonProgress.ts — but it
// is device-local, which is why the caption is not optional.
const GrammarCourseCard: React.FC<GrammarCourseCardProps> = ({ course, lessons, progress }) => {
  const { t } = useTranslation();

  const category = deriveGrammarCategory(course);
  const level = deriveCourseLevel(course);

  // Paints immediately from the course response; the lessons array arrives
  // later and is authoritative once it does.
  const lessonCount = lessons ? lessons.length : (course._count?.lessons ?? 0);
  const totalMinutes = lessons
    ? lessons.reduce((sum, lesson) => sum + (lesson.estimatedStudyMinutes ?? 0), 0)
    : 0;

  // Only once something has actually been completed. A 0% bar is not a
  // neutral placeholder — it is a claim about the student's progress that
  // an untouched course has not earned.
  const showProgress = progress !== null && progress.completed > 0;
  const isComplete = showProgress && progress.completed === progress.total;

  const categoryLabels: Record<GrammarCategory, string> = {
    TOEIC: t.grammar.categoryTOEIC,
    GRAMMAR_IN_USE: t.grammar.categoryGrammarInUse,
    DESTINATION: t.grammar.categoryDestination,
    FOUNDATION: t.grammar.categoryFoundation,
  };

  return (
    <Link
      to={`/courses/${course.id}`}
      className="group flex flex-col bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl dark:hover:shadow-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {/* Thumbnail band with a scrim so the badges stay legible on any image */}
      <div className="relative h-44 w-full overflow-hidden bg-indigo-50 dark:bg-ink-950">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-indigo-400 dark:text-indigo-400/70"
            aria-hidden="true"
          >
            <BookOpen size={44} />
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent dark:from-ink-900 dark:via-ink-900/40"
          aria-hidden="true"
        />

        {(level || category) && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
            {level && (
              <span className="px-3 py-1 rounded-full text-[11px] font-black bg-white/90 text-slate-800 dark:bg-black/70 dark:text-white backdrop-blur-md">
                {level}
              </span>
            )}
            {category && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-600/90 text-white backdrop-blur-md">
                {categoryLabels[category]}
              </span>
            )}
          </div>
        )}

        {/* Only ever shown from real completion, never as decoration. */}
        {isComplete && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1">
            <CheckCircle2 size={13} aria-hidden="true" />
            <span>{t.lesson.stageCompleted}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-6 gap-3">
        <h3 className="text-[17px] font-black text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
          {course.title}
        </h3>

        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">
          {course.description}
        </p>

        <div className="pt-3 border-t border-slate-100 dark:border-ink-700/80 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
              {lessonCount} {lessonCount === 1 ? t.grammar.oneLessonUnit : t.grammar.lessonsUnit}
            </span>
            {/* Absent, not zeroed, when no lesson carries a study time. */}
            {totalMinutes > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
                {totalMinutes} {t.grammar.minutesUnit}
              </span>
            )}
          </div>

          {showProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500 dark:text-slate-400">{t.grammar.progressLabel}</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {progress.completed}/{progress.total} ({progress.percent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progress.percent}%` }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                />
              </div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                {t.grammar.onThisDevice}
              </p>
            </div>
          )}

          <p className="flex items-center justify-between text-[13px] font-bold text-indigo-600 dark:text-indigo-400 pt-0.5">
            <span>{t.grammar.viewLessons}</span>
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </p>
        </div>
      </div>
    </Link>
  );
};

export default GrammarCourseCard;
