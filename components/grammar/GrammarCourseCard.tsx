import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, ChevronRight, Clock, Layers } from 'lucide-react';
import { Course } from '../../types';
import { GrammarCategory, deriveCourseLevel, deriveGrammarCategory } from './grammarCategory';
import { CourseProgressSummary } from '../../services/courseProgressService';
import { statusPresentation } from '../../services/courseStatus';
import { useTranslation } from '../../i18n/useTranslation';

interface GrammarCourseCardProps {
  course: Course;
  // Sprint 08 — the server's summary. `null` while the ONE batch request is in
  // flight or after it failed; the card then shows no status rather than
  // guessing one.
  //
  // The `lessons: Lesson[]` prop is GONE. It existed so the card could count
  // lessons and sum durations, which forced the roadmap to fetch every lesson
  // of every course — one request per card, on top of one progress request per
  // card. Both numbers now arrive with the data that was already being
  // fetched: totalLessons here, course.totalEstimatedMinutes on the course.
  progress: CourseProgressSummary | null;
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
const GrammarCourseCard: React.FC<GrammarCourseCardProps> = ({ course, progress }) => {
  const { t } = useTranslation();

  const category = deriveGrammarCategory(course);
  const level = deriveCourseLevel(course);

  // Both come from GET /courses, which the roadmap already fetches. Neither
  // needs a per-course lessons request any more.
  //
  // `_count.lessons` counts every published lesson; `progress.totalLessons`
  // counts only the ones a student can actually complete. They differ when a
  // course holds an audio-only lesson, and the completable figure is the
  // honest one to show beside a percentage derived from it.
  const lessonCount = progress ? progress.totalLessons : (course._count?.lessons ?? 0);
  const totalMinutes = course.totalEstimatedMinutes ?? 0;

  const presentation = progress ? statusPresentation(progress.status, t) : null;

  // Only once something has actually been completed. A 0% bar is not a
  // neutral placeholder — it is a claim about the student's progress that
  // an untouched course has not earned.
  const showProgress = progress !== null && progress.completedLessons > 0;
  const isComplete = progress?.status === 'COMPLETED';

  // Always the course's lesson list, never a specific lesson — the roadmap
  // grid is an overview surface, and jumping straight into "Học tiếp"'s
  // lesson skipped that overview for a student who might want a different
  // lesson than the one they left off on. `CourseDetailPage` (at this route)
  // already shows real per-lesson status and its own "Học tiếp" per row.
  const target = `/courses/${course.id}`;

  const categoryLabels: Record<GrammarCategory, string> = {
    TOEIC: t.grammar.categoryTOEIC,
    GRAMMAR_IN_USE: t.grammar.categoryGrammarInUse,
    DESTINATION: t.grammar.categoryDestination,
    FOUNDATION: t.grammar.categoryFoundation,
  };

  return (
    <Link
      to={target}
      className="group flex flex-col bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl dark:hover:shadow-blue-500/10 hover:border-blue-200 dark:hover:border-blue-500/50 hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      {/* Thumbnail band with a scrim so the badges stay legible on any image */}
      <div className="relative h-44 w-full overflow-hidden bg-blue-50 dark:bg-ink-950">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-blue-400 dark:text-blue-400/70"
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
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-600/90 text-white backdrop-blur-md">
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
        <h3 className="text-[17px] font-black text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
          {course.title}
        </h3>

        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">
          {course.description}
        </p>

        <div className="pt-3 border-t border-slate-100 dark:border-ink-700/80 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-blue-500 dark:text-blue-400" aria-hidden="true" />
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
                <span className="text-blue-600 dark:text-blue-400">
                  {progress.completedLessons}/{progress.totalLessons} (
                  {progress.progressPercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progress.progressPercent}%` }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                />
              </div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                {t.grammar.progressSynced}
              </p>
            </div>
          )}

          {/* The CTA says what this card will actually do. Before progress
              lands it stays the neutral "view lessons" rather than guessing
              between Bắt đầu and Học tiếp. */}
          <p className="flex items-center justify-between text-[13px] font-bold text-blue-600 dark:text-blue-400 pt-0.5">
            <span>{presentation ? presentation.cta : t.grammar.viewLessons}</span>
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </p>
        </div>
      </div>
    </Link>
  );
};

export default GrammarCourseCard;
