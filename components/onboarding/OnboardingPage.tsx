import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LearningGoal } from '../../types';
import {
  PlacementAttemptState,
  PlacementResult,
  getPlacementAttempt,
  getPlacementStatus,
} from '../../services/placementService';
import { authService } from '../../services/authService';
import { handleAuthError } from '../../services/apiError';
import { useTranslation } from '../../i18n/useTranslation';
import ErrorState from '../shared/ErrorState';
import Skeleton from '../shared/Skeleton';
import GoalStep from './GoalStep';
import StartMethodStep from './StartMethodStep';
import PlacementTestStep from './PlacementTestStep';
import ResultStep from './ResultStep';
import RoadmapStep from './RoadmapStep';

type Step = 'loading' | 'error' | 'goal' | 'method' | 'test' | 'result' | 'roadmap';

interface OnboardingPageProps {
  /**
   * Phase 7 — mounted at /onboarding/retake instead of /onboarding. An
   * already-onboarded student deliberately came back to reassess their
   * level, so the "already onboarded -> bounce to /home" self-correction
   * below must NOT fire here; everywhere else in this component is already
   * driven entirely by GET /placement/status's other fields (learningGoal,
   * hasInProgressAttempt), none of which are onboarded-gated, so this is the
   * ONLY behavioural difference retake needs. See App.tsx's route comment
   * for why OnboardingGateBoundary lets /onboarding/retake through
   * unconditionally without any change to that component.
   */
  retake?: boolean;
}

// Personalized Onboarding & Placement Test — the wizard orchestrator.
//
// Server-truth-driven on every mount via GET /placement/status, the wizard's
// own resume authority (never the app-wide gate — see
// OnboardingGateBoundary.tsx's header note). This is what makes resume work
// for every entry point: a fresh user, a refresh mid-test, or a student who
// closed the tab between steps all land on the SAME correct step, because
// none of it is inferred from local state.
//
// SELF-CORRECTION: on the FIRST-TIME route only, if status.onboarded is true
// (the gate's local cache was stale or missing — see the gate's own `!==
// true` reasoning), this patches localStorage and bounces to /home
// immediately rather than showing the wizard to an already-onboarded
// account. Skipped entirely in retake mode — see OnboardingPageProps.
const OnboardingPage: React.FC<OnboardingPageProps> = ({ retake = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('loading');
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [attempt, setAttempt] = useState<PlacementAttemptState | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Patches the LOCAL cache OnboardingGateBoundary reads synchronously, the
  // moment the SERVER has actually onboarded this account (never before —
  // see placement.service.ts's finalize contract: onboardedAt is set only
  // once a Roadmap has successfully generated).
  const markOnboarded = () => {
    const current = authService.getUser();
    if (current) authService.updateStoredUser({ ...current, onboarded: true });
  };

  const resume = useCallback(async () => {
    // /onboarding/retake has no route-level role guard the way plain
    // /onboarding does (OnboardingGateBoundary bounces a non-USER away from
    // THAT exact path, but never matches this sibling one — see App.tsx's
    // route comment). Reproduced here, scoped to retake only, rather than
    // teaching the shared, already-tested gate a second special case for a
    // path only this component's callers ever link to.
    if (retake && authService.getUser()?.role !== 'USER') {
      navigate('/home', { replace: true });
      return;
    }

    setStep('loading');
    setLoadError(null);
    try {
      const status = await getPlacementStatus();

      if (status.onboarded && !retake) {
        markOnboarded();
        navigate('/home', { replace: true });
        return;
      }

      setGoal(status.learningGoal);

      if (!status.learningGoal) {
        setStep('goal');
        return;
      }

      if (status.hasInProgressAttempt) {
        const current = await getPlacementAttempt();
        setAttempt(current);
        setStep('test');
        return;
      }

      setStep('method');
    } catch (err) {
      setLoadError(handleAuthError(err, navigate) || t.common.loadFailed);
      setStep('error');
    }
  }, [navigate, retake, t.common.loadFailed]);

  useEffect(() => {
    void resume();
  }, [resume]);

  const handleGoalSaved = (savedGoal: LearningGoal) => {
    setGoal(savedGoal);
    setStep('method');
  };

  const handleBeginnerStarted = () => {
    markOnboarded();
    setStep('roadmap');
  };

  const handlePlacementStarted = (startedAttempt: PlacementAttemptState) => {
    setAttempt(startedAttempt);
    setStep('test');
  };

  const handleBackToGoal = () => setStep('goal');

  const handleBackToMethod = () => setStep('method');

  const handleTestCompleted = (testResult: PlacementResult) => {
    markOnboarded();
    setResult(testResult);
    setStep('result');
  };

  const handleResultContinue = () => setStep('roadmap');

  const handleRoadmapFinished = () => navigate('/home', { replace: true });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        {step === 'loading' && <Skeleton className="h-96 w-full rounded-3xl" />}

        {step === 'error' && (
          <ErrorState message={loadError ?? t.common.loadFailed} onRetry={() => void resume()} />
        )}

        {step === 'goal' && <GoalStep initialGoal={goal} onSaved={handleGoalSaved} />}

        {step === 'method' && (
          <StartMethodStep
            onBack={handleBackToGoal}
            onBeginnerStarted={handleBeginnerStarted}
            onPlacementStarted={handlePlacementStarted}
          />
        )}

        {step === 'test' && attempt && (
          <PlacementTestStep attempt={attempt} onCompleted={handleTestCompleted} onBack={handleBackToMethod} />
        )}

        {step === 'result' && result && (
          <ResultStep result={result} onContinue={handleResultContinue} />
        )}

        {step === 'roadmap' && <RoadmapStep onFinished={handleRoadmapFinished} />}
      </div>
    </div>
  );
};

export default OnboardingPage;
