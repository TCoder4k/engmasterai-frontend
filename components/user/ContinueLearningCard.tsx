import React from 'react';
import { BookOpen } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

// Honest preview state: there is no lesson-progress backend or student lesson
// page yet, so no course name, lesson number, or progress percentage is shown
// and there is no dead CTA. When lessons ship, this card becomes the real
// "resume where you left off" entry point.
const ContinueLearningCard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section aria-label={t.dashboard.continueLearning}>
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-4">
        {t.dashboard.continueLearning}
      </h2>
      <div className="bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-100/60 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          className="w-full h-28 sm:w-36 sm:h-24 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-100 dark:shadow-none"
          aria-hidden="true"
        >
          <BookOpen size={40} className="text-white/90" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[11px] font-bold text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/20 px-2.5 py-1 rounded-md">
            {t.common.comingSoon}
          </span>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-2">
            {t.dashboard.noLearningActivity}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
            {t.dashboard.continueLearningHint}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ContinueLearningCard;
