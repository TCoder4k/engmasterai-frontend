import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface LessonStepperProps {
  hasNotes: boolean;
}

// Lightweight step indicator, not a progress bar — Mini Check/Summary/
// Complete are honestly labeled "(soon)" since they depend on the
// LessonTask/Question backend module this sprint doesn't build (design
// doc §6.5, §7.9).
const LessonStepper: React.FC<LessonStepperProps> = ({ hasNotes }) => {
  const { t } = useTranslation();
  const steps = [t.lesson.stepOverview, t.lesson.stepVideo];
  if (hasNotes) steps.push(t.lesson.stepNotes);
  steps.push(t.lesson.stepMiniCheckSoon);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-6" aria-label={t.lesson.stepperLabel}>
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            {step}
          </span>
          {index < steps.length - 1 && <span className="text-slate-200 dark:text-slate-700">/</span>}
        </li>
      ))}
    </ol>
  );
};

export default LessonStepper;
