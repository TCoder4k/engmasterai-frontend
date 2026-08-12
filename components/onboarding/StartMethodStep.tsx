import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Rocket, Target } from 'lucide-react';
import {
  PlacementAttemptState,
  startBeginnerPlacement,
  startPlacementTest,
} from '../../services/placementService';
import { handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';

interface StartMethodStepProps {
  onBack: () => void;
  onBeginnerStarted: () => void;
  onPlacementStarted: (attempt: PlacementAttemptState) => void;
}

type StartingMethod = 'beginner' | 'placement' | null;

// Step 2 — "Find your starting point". Two doors: skip the test entirely
// (start-beginner), or take the 12-question placement test.
const StartMethodStep: React.FC<StartMethodStepProps> = ({
  onBack,
  onBeginnerStarted,
  onPlacementStarted,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [starting, setStarting] = useState<StartingMethod>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBeginner = async () => {
    if (starting) return;
    setStarting('beginner');
    setError(null);
    try {
      await startBeginnerPlacement();
      onBeginnerStarted();
    } catch (err) {
      setError(handleAuthError(err, navigate) || t.onboarding.methodStartFailed);
      setStarting(null);
    }
  };

  const handlePlacement = async () => {
    if (starting) return;
    setStarting('placement');
    setError(null);
    try {
      const attempt = await startPlacementTest();
      onPlacementStarted(attempt);
    } catch (err) {
      setError(handleAuthError(err, navigate) || t.onboarding.methodStartFailed);
      setStarting(null);
    }
  };

  return (
    <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        disabled={starting !== null}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t.common.back}
      </button>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {t.onboarding.methodStepTitle}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t.onboarding.methodStepSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => void handleBeginner()}
          disabled={starting !== null}
          className="text-left p-6 rounded-2xl border-2 border-slate-100 dark:border-ink-700 bg-white dark:bg-ink-950 hover:border-blue-300 dark:hover:border-blue-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Rocket className="w-8 h-8 text-blue-500 mb-3" aria-hidden="true" />
          <p className="font-bold text-slate-900 dark:text-white">
            {t.onboarding.methodBeginnerTitle}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.onboarding.methodBeginnerDescription}
          </p>
          {starting === 'beginner' && (
            <p className="text-xs font-bold text-blue-600 mt-3">{t.common.loading}</p>
          )}
        </button>

        <button
          type="button"
          onClick={() => void handlePlacement()}
          disabled={starting !== null}
          className="text-left p-6 rounded-2xl border-2 border-blue-100 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Target className="w-8 h-8 text-blue-600 mb-3" aria-hidden="true" />
          <p className="font-bold text-slate-900 dark:text-white">
            {t.onboarding.methodPlacementTitle}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.onboarding.methodPlacementDescription}
          </p>
          {starting === 'placement' && (
            <p className="text-xs font-bold text-blue-600 mt-3">{t.common.loading}</p>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400 text-center">
          {error}
        </p>
      )}
    </div>
  );
};

export default StartMethodStep;
