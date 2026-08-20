
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import SpeakingScenarioCard from './SpeakingScenarioCard';
import type { SpeakingScenarioCard as SpeakingScenarioCardData } from '../../../services/speakingService';

interface SpeakingScenarioGridProps {
  scenarios: SpeakingScenarioCardData[];
}

const SpeakingScenarioGrid: React.FC<SpeakingScenarioGridProps> = ({ scenarios }) => {
  const { t, language } = useTranslation();

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {t.practice.speakingContextSectionTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.practice.speakingContextSectionDesc}</p>
        </div>
        <div className="hidden sm:block shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
          {t.practice.speakingScenarioCount(scenarios.length)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {scenarios.map((scenario) => (
          <SpeakingScenarioCard
            key={scenario.id}
            id={scenario.id}
            name={scenario.name}
            title={language === 'vi' ? scenario.nameVi : scenario.name}
            description={language === 'vi' ? scenario.descriptionVi : scenario.description}
            level={scenario.level}
          />
        ))}
      </div>
    </section>
  );
};

export default SpeakingScenarioGrid;
