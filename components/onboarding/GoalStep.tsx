import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { LearningGoal } from '../../types';
import { setPlacementGoal } from '../../services/placementService';
import { handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';

interface GoalStepProps {
  initialGoal: LearningGoal | null;
  onSaved: (goal: LearningGoal) => void;
}

// Step 1 of the onboarding wizard — "What's your learning goal?"
// PUT /placement/goal is always allowed (never blocked, even post-
// onboarding), so this step's own save call is safe to repeat.
const GoalStep: React.FC<GoalStepProps> = ({ initialGoal, onSaved }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<LearningGoal | null>(initialGoal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goals: { value: LearningGoal; label: string; description: string }[] = [
    {
      value: 'FOUNDATION',
      label: t.onboarding.goalFoundation,
      description: t.onboarding.goalFoundationDescription,
    },
    {
      value: 'TOEIC_450',
      label: t.onboarding.goalToeic450,
      description: t.onboarding.goalToeic450Description,
    },
    {
      value: 'TOEIC_650',
      label: t.onboarding.goalToeic650,
      description: t.onboarding.goalToeic650Description,
    },
    {
      value: 'TOEIC_800',
      label: t.onboarding.goalToeic800,
      description: t.onboarding.goalToeic800Description,
    },
    {
      value: 'GENERAL_ENGLISH',
      label: t.onboarding.goalGeneralEnglish,
      description: t.onboarding.goalGeneralEnglishDescription,
    },
    {
      value: 'REGULAR_PRACTICE',
      label: t.onboarding.goalRegularPractice,
      description: t.onboarding.goalRegularPracticeDescription,
    },
  ];

  const handleContinue = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setPlacementGoal(selected);
      onSaved(selected);
    } catch (err) {
      setError(handleAuthError(err, navigate) || t.onboarding.goalSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {t.onboarding.goalStepTitle}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t.onboarding.goalStepSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {goals.map((goal) => {
          const isSelected = selected === goal.value;
          return (
            <button
              key={goal.value}
              type="button"
              onClick={() => setSelected(goal.value)}
              className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-500/10 ring-4 ring-blue-600/10'
                  : 'border-slate-100 dark:border-ink-700 bg-white dark:bg-ink-950 hover:border-slate-200 dark:hover:border-ink-600'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 p-0.5 bg-blue-600 rounded-full">
                  <Check className="w-3 h-3 text-white" aria-hidden="true" />
                </div>
              )}
              <p className="font-bold text-slate-900 dark:text-white pr-6">{goal.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {goal.description}
              </p>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400 text-center">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleContinue()}
        disabled={!selected || saving}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? t.common.loading : t.onboarding.goalContinue}
      </button>
    </div>
  );
};

export default GoalStep;
