import React from 'react';
import { BookOpen, CheckSquare, FileText, Video } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface LessonStepperProps {
  hasNotes: boolean;
}

// Stage indicator, NOT a progress bar. Sprint 05 re-authored it into the
// design reference's HorizontalStepper anatomy (numbered badge + icon +
// label + status line), but kept its original honest semantics:
//
//   - It shows the stages this lesson actually has. Nothing is marked
//     "completed", because there is no LessonTaskProgress API — no backend
//     can say whether a student finished anything.
//   - It is deliberately NOT interactive. The reference's stepper switches
//     between stage views; this page renders the whole lesson in one scroll,
//     so clickable steps would be a lie about navigation that doesn't exist.
//   - Mini check is rendered as a visibly unavailable stage. The reference's
//     Quiz / Trap Hunter / Advanced Practice stages are not ported at all:
//     they need LessonTask/Question, which exist as Prisma models with no
//     module, no controller and no endpoints (docs/sprints/sprint-05-*).
const LessonStepper: React.FC<LessonStepperProps> = ({ hasNotes }) => {
  const { t } = useTranslation();

  const steps: { label: string; icon: React.ReactNode; available: boolean }[] = [
    { label: t.lesson.stepOverview, icon: <FileText size={13} />, available: true },
    { label: t.lesson.stepVideo, icon: <Video size={13} />, available: true },
  ];
  if (hasNotes) {
    steps.push({ label: t.lesson.stepNotes, icon: <BookOpen size={13} />, available: true });
  }
  steps.push({ label: t.lesson.stepMiniCheckSoon, icon: <CheckSquare size={13} />, available: false });

  return (
    <ol
      aria-label={t.lesson.stepperLabel}
      className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3"
    >
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
            step.available
              ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
              : 'border-dashed border-slate-200 dark:border-slate-700'
          }`}
        >
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
              step.available
                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
            }`}
            aria-hidden="true"
          >
            {index + 1}
          </span>

          <span className="min-w-0">
            <span
              className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide truncate ${
                step.available
                  ? 'text-slate-600 dark:text-slate-300'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span aria-hidden="true">{step.icon}</span>
              <span className="truncate">{step.label}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
};

export default LessonStepper;
