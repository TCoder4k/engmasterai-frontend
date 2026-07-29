import React from 'react';
import { Target, Lock, CheckCircle2 } from 'lucide-react';
import {
  PracticeAvailability,
  PracticeProgress,
  PracticeTaskSummary,
} from '../../../services/practiceService';
import { useTranslation } from '../../../i18n/useTranslation';

interface PracticeIntroProps {
  availability: PracticeAvailability;
  task: PracticeTaskSummary | null;
  progress: PracticeProgress;
  starting: boolean;
  onStart: () => void;
}

// Sprint 06D — the screen a student meets before Advanced Practice begins.
//
// IT STARTS NOTHING. Rendering this does not create an attempt, stamp a clock
// or consume anything — the GET behind it is read-only on the server, and the
// only thing that begins an attempt is the button below. That is why the
// stage has an intro at all: without it, merely opening the tab would record
// time against an attempt the student never took.
//
// Every number here is authored or server-recorded. There is deliberately no
// estimated duration: none is stored, and a plausible-looking guess is still
// a fabricated number in front of a student.
const PracticeIntro: React.FC<PracticeIntroProps> = ({
  availability,
  task,
  progress,
  starting,
  onStart,
}) => {
  const { t } = useTranslation();
  const copy = t.lesson.practice;

  if (availability.state === 'unavailable' || !task) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-ink-700 dark:bg-ink-800"
        role="status"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{copy.unavailable}</p>
      </div>
    );
  }

  // A real, live stage whose prerequisite is not met. Says WHICH one — a
  // generic lock would leave the student guessing what to do next.
  if (availability.state === 'blocked') {
    return (
      <div
        className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center dark:border-amber-500/40 dark:bg-amber-500/10"
        role="status"
      >
        <Lock size={22} className="mx-auto mb-3 text-amber-600 dark:text-amber-400" aria-hidden />
        <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
          {copy.blockedTitle}
        </h3>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
          {availability.reason === 'quiz_not_passed'
            ? copy.blockedQuiz
            : copy.blockedTraps}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-ink-700 dark:bg-ink-800">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <Target size={20} aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{copy.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{copy.subtitle}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-ink-900/60">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {copy.questionsLabel}
          </dt>
          <dd className="mt-1 text-xl font-black text-slate-900 dark:text-white">
            {task.questionCount}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-ink-900/60">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {copy.passingLabel}
          </dt>
          <dd className="mt-1 text-xl font-black text-slate-900 dark:text-white">
            {task.passingScorePercent}%
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-ink-900/60">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {copy.feedbackLabel}
          </dt>
          <dd className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
            {task.feedbackMode === 'IMMEDIATE' ? copy.feedbackImmediate : copy.feedbackOnSubmit}
          </dd>
        </div>
      </dl>

      {/* Only shown once there is something real to show. */}
      {progress.attemptsCount > 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          {progress.passed && (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
          )}
          {copy.attemptsSoFar(progress.attemptsCount)}
          {progress.bestScorePercent !== null && ` · ${copy.best(progress.bestScorePercent)}`}
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="mt-6 w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {starting ? copy.starting : progress.attemptsCount > 0 ? copy.retry : copy.start}
      </button>
    </div>
  );
};

export default PracticeIntro;
