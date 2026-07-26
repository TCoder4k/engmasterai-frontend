import React from 'react';
import { BookOpen, Check, CheckSquare, Lock, Target, Video } from 'lucide-react';
import { LessonStageId, StageStatus } from '../../services/lessonProgress';
import { useTranslation } from '../../i18n/useTranslation';

interface LessonStageStepperProps {
  currentStage: LessonStageId;
  statuses: Record<LessonStageId, StageStatus>;
  onSelectStage: (stage: LessonStageId) => void;
}

// The five-stage lesson stepper, matching the design reference's anatomy
// (numbered badge + icon + title + status line, 2-col on phones, 5-col from
// sm up).
//
// Stages 3-5 (Quiz Part 5 / Trap Hunter / Advanced practice) require
// LessonTask/Question, which exists as Prisma models with no module, no
// controller and no endpoints. They render with the same shape but are
// `aria-disabled`, are not buttons, carry a lock, and show "Coming soon"
// instead of a status. That is deliberate: a locked tile is honest, whereas
// a tile reading "Not started" would imply a student could start it.
const STAGE_ICONS: Record<LessonStageId, React.ReactNode> = {
  video: <Video size={13} />,
  theory: <BookOpen size={13} />,
  quiz: <CheckSquare size={13} />,
  traphunter: <Target size={13} />,
  practice: <Target size={13} />,
};

const LessonStageStepper: React.FC<LessonStageStepperProps> = ({
  currentStage,
  statuses,
  onSelectStage,
}) => {
  const { t } = useTranslation();

  const stages: { id: LessonStageId; label: string }[] = [
    { id: 'video', label: t.lesson.stageVideo },
    { id: 'theory', label: t.lesson.stageTheory },
    { id: 'quiz', label: t.lesson.stageQuiz },
    { id: 'traphunter', label: t.lesson.stageTrapHunter },
    { id: 'practice', label: t.lesson.stagePractice },
  ];

  const statusLabel = (status: StageStatus): string => {
    switch (status) {
      case 'completed':
        return t.lesson.stageCompleted;
      case 'in_progress':
        return t.lesson.stageInProgress;
      case 'locked':
        return t.lesson.stageComingSoon;
      case 'unavailable':
        return t.lesson.stageUnavailable;
      default:
        return t.lesson.stageNotStarted;
    }
  };

  return (
    <ol
      aria-label={t.lesson.stageStepperLabel}
      className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-6 bg-white dark:bg-ink-900 border border-slate-100 dark:border-ink-700 rounded-2xl p-3 shadow-sm dark:shadow-xl"
    >
      {stages.map((stage, index) => {
        const status = statuses[stage.id];
        const isLocked = status === 'locked';
        const isUnavailable = status === 'unavailable';
        const isSelectable = !isLocked && !isUnavailable;
        const isActive = currentStage === stage.id && isSelectable;
        const isCompleted = status === 'completed';

        const shellClass = isActive
          ? 'border-indigo-500 bg-indigo-50 dark:bg-ink-800 dark:border-indigo-500 shadow-md shadow-indigo-500/10'
          : isCompleted
            ? 'border-emerald-300 bg-emerald-50/60 dark:bg-ink-950 dark:border-emerald-500/40'
            : isSelectable
              ? 'border-slate-100 bg-slate-50 hover:border-indigo-300 dark:bg-ink-950 dark:border-ink-700 dark:hover:border-indigo-500'
              : 'border-dashed border-slate-200 bg-transparent dark:border-ink-700';

        const badgeClass = isCompleted
          ? 'bg-emerald-500 text-white'
          : isActive
            ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md'
            : isSelectable
              ? 'bg-white text-indigo-500 border border-slate-200 dark:bg-ink-900 dark:text-indigo-400 dark:border-ink-700'
              : 'bg-slate-100 text-slate-400 dark:bg-ink-900 dark:text-slate-600';

        const content = (
          <>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 ${badgeClass}`}
              aria-hidden="true"
            >
              {isCompleted ? <Check size={15} strokeWidth={3} /> : isLocked ? <Lock size={13} /> : index + 1}
            </span>

            <span className="min-w-0 text-left">
              <span
                className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-bold truncate ${
                  isActive
                    ? 'text-indigo-700 dark:text-white'
                    : isSelectable
                      ? 'text-slate-700 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <span aria-hidden="true">{STAGE_ICONS[stage.id]}</span>
                <span className="truncate">{stage.label}</span>
              </span>
              <span
                className={`block text-[10px] font-semibold mt-0.5 ${
                  isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isActive
                      ? 'text-indigo-500 dark:text-indigo-300'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {statusLabel(status)}
              </span>
            </span>
          </>
        );

        return (
          <li key={stage.id}>
            {isSelectable ? (
              <button
                type="button"
                onClick={() => onSelectStage(stage.id)}
                aria-current={isActive ? 'step' : undefined}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${shellClass}`}
              >
                {content}
              </button>
            ) : (
              <div
                aria-disabled="true"
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-not-allowed select-none ${shellClass}`}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default LessonStageStepper;
