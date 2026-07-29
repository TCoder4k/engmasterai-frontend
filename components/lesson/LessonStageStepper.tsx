import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Check, CheckSquare, Lock, Target, Video } from 'lucide-react';
import { LessonStageId, StageStatus } from '../../services/lessonProgress';
import { useTranslation } from '../../i18n/useTranslation';
import { SPRING } from '../shared/motion';

interface LessonStageStepperProps {
  currentStage: LessonStageId;
  statuses: Record<LessonStageId, StageStatus>;
  onSelectStage: (stage: LessonStageId) => void;
}

// The five-stage lesson stepper, matching the design reference's anatomy
// (numbered badge + icon + title + status line, 2-col on phones, 5-col from
// sm up).
//
// As of Sprint 06D every one of the five stages has a real module behind it,
// so no tile is constant-`locked` any more and "Coming soon" no longer
// appears on this page. Nothing in this component changed to make that true:
// it renders whatever StageStatus it is handed, and the four not-startable
// statuses ('locked', 'blocked', 'unavailable', 'skipped') already had
// distinct treatments from Sprint 06C. 'locked' is kept for a stage that
// ever ships in the UI ahead of its backend — a locked tile is honest,
// whereas one reading "Not started" would imply a student could start it.
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

  // Sprint 06C added the 'blocked' and 'skipped' cases. Both MUST be listed
  // explicitly: the `default` below would otherwise label them "Not started",
  // which is wrong in opposite directions — one is a stage you cannot begin,
  // the other one you already earned your way past.
  const statusLabel = (status: StageStatus): string => {
    switch (status) {
      case 'completed':
        return t.lesson.stageCompleted;
      case 'in_progress':
        return t.lesson.stageInProgress;
      case 'locked':
        return t.lesson.stageComingSoon;
      case 'blocked':
        return t.lesson.stageBlocked;
      case 'skipped':
        return t.lesson.stageSkipped;
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
        // Sprint 06C — a real stage whose prerequisite is unmet. Carries the
        // padlock like 'locked' (it genuinely cannot be opened yet) but its
        // own label, so it never claims a shipped feature is unbuilt.
        const isBlocked = status === 'blocked';
        const isUnavailable = status === 'unavailable';
        // Nothing to do here, and nothing owed — a quiz answered perfectly.
        const isSkipped = status === 'skipped';
        const isSelectable = !isLocked && !isBlocked && !isUnavailable && !isSkipped;
        const isActive = currentStage === stage.id && isSelectable;
        const isCompleted = status === 'completed';

        const shellClass = isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-ink-800 dark:border-blue-500 shadow-md shadow-blue-500/10'
          : isCompleted
            ? 'border-emerald-300 bg-emerald-50/60 dark:bg-ink-950 dark:border-emerald-500/40'
            : isSelectable
              ? 'border-slate-100 bg-slate-50 hover:border-blue-300 dark:bg-ink-950 dark:border-ink-700 dark:hover:border-blue-500'
              : 'border-dashed border-slate-200 bg-transparent dark:border-ink-700';

        const badgeClass = isCompleted
          ? 'bg-emerald-500 text-white'
          : isActive
            ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md'
            : // Skipped gets a tick, but a NEUTRAL one: the student did
              // nothing here and owes nothing here, so emerald (which this
              // stepper reserves for work completed) would overstate it.
              isSkipped
              ? 'bg-slate-200 text-slate-500 dark:bg-ink-800 dark:text-slate-400'
              : isSelectable
                ? 'bg-white text-blue-500 border border-slate-200 dark:bg-ink-900 dark:text-blue-400 dark:border-ink-700'
                : 'bg-slate-100 text-slate-400 dark:bg-ink-900 dark:text-slate-600';

        const content = (
          <>
            {/*
              Sprint 06B.5 — the badge glyph used to hard-cut between a
              number, a tick and a padlock. Keying the motion span on the
              status makes each change a spring pop instead.

              This is also the generic "unlock" moment: it is driven purely
              by a stage's status changing, never special-cased to one
              tile. Sprint 06C gave it its first real transition (Trap
              Hunter unlocking after a submit) and Sprint 06D a second
              (Advanced Practice opening once traps are cleared) — both
              without a line of change here, which is what "generic" was
              supposed to buy.
            */}
            <motion.span
              key={status}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 ${badgeClass}`}
              aria-hidden="true"
            >
              {isCompleted || isSkipped ? (
                <Check size={15} strokeWidth={3} />
              ) : isLocked || isBlocked ? (
                <Lock size={13} />
              ) : (
                index + 1
              )}
            </motion.span>

            <span className="min-w-0 text-left">
              <span
                className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-bold truncate ${
                  isActive
                    ? 'text-blue-700 dark:text-white'
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
                      ? 'text-blue-500 dark:text-blue-300'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
                // "No traps — perfect quiz" and "Finish the quiz first" are
                // longer than every other status string and get truncated to
                // nothing useful at this size on a narrow tile.
                title={isSkipped || isBlocked ? statusLabel(status) : undefined}
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
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${shellClass}`}
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
