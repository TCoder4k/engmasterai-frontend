import React, { useEffect, useState } from 'react';
import { Trophy, BookOpen, Type, Headphones, Loader2 } from 'lucide-react';
import { CefrLevel } from '../../types';
import {
  PlacementResult,
  requestPlacementRoadmapPlan,
} from '../../services/placementService';
import { useTranslation } from '../../i18n/useTranslation';
import { StringKeys, TranslationDict } from '../../i18n/translations';
import PlacementReviewPanel from './PlacementReviewPanel';

interface ResultStepProps {
  result: PlacementResult;
  onContinue: () => void;
}

const LEVEL_NAME_KEY: Record<CefrLevel, StringKeys<TranslationDict['onboarding']>> = {
  A1: 'levelNameA1',
  A2: 'levelNameA2',
  B1: 'levelNameB1',
  B2: 'levelNameB2',
  C1: 'levelNameC1',
  C2: 'levelNameC2',
};

const LEVEL_ENCOURAGEMENT_KEY: Record<CefrLevel, StringKeys<TranslationDict['onboarding']>> = {
  A1: 'levelEncouragementA1',
  A2: 'levelEncouragementA2',
  B1: 'levelEncouragementB1',
  B2: 'levelEncouragementB2',
  C1: 'levelEncouragementC1',
  C2: 'levelEncouragementC2',
};

const RADIUS = 54;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Step 4 — the server-graded result. Every SCORE and per-section X/Y count
// here comes straight from the backend response (see PlacementResult) —
// never re-derived from a rounded percentage, which is lossy once a section
// has more than 4 questions. Only presentation (level names, encouragement
// copy, progress-bar widths) is derived client-side from those values.
const ResultStep: React.FC<ResultStepProps> = ({ result, onContinue }) => {
  const { t } = useTranslation();
  const [showReview, setShowReview] = useState(false);
  const [planningState, setPlanningState] = useState<'planning' | 'ready'>('planning');

  // POST /placement/roadmap/plan — hybrid AI-assisted, multi-pillar resource
  // selection. Fired automatically on mount, not on a click — the student
  // never needs to know AI was involved. Always resolves with a valid
  // roadmap either way (AI-selected or the deterministic fallback — see the
  // backend's requestRoadmapPlan), so a genuine network/auth error is safe
  // to swallow: the deterministic roadmap from finalizeNow already exists,
  // and the primary button below simply stays enabled either way. The
  // backend itself is idempotent per roadmap generation (aiPlanningUsedAt),
  // so no de-duplication is needed here even across a refresh/remount.
  useEffect(() => {
    let cancelled = false;
    requestPlacementRoadmapPlan()
      .catch(() => {
        // Swallowed deliberately — see the comment above.
      })
      .finally(() => {
        if (!cancelled) setPlanningState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (showReview) {
    return (
      <PlacementReviewPanel attemptId={result.attemptId} onBack={() => setShowReview(false)} />
    );
  }

  const sections: {
    key: string;
    label: string;
    score: number;
    correct: number;
    total: number;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: string;
    barClass: string;
  }[] = [
    {
      key: 'grammar',
      label: t.onboarding.resultGrammarScore,
      score: result.grammarScore,
      correct: result.grammarCorrect,
      total: result.grammarTotal,
      icon: BookOpen,
      accent: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
      barClass: 'bg-blue-500',
    },
    {
      key: 'vocabulary',
      label: t.onboarding.resultVocabularyScore,
      score: result.vocabularyScore,
      correct: result.vocabularyCorrect,
      total: result.vocabularyTotal,
      icon: Type,
      accent: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
      barClass: 'bg-emerald-500',
    },
    {
      key: 'listening',
      label: t.onboarding.resultListeningScore,
      score: result.listeningScore,
      correct: result.listeningCorrect,
      total: result.listeningTotal,
      icon: Headphones,
      accent: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
      barClass: 'bg-violet-500',
    },
  ];

  const offset = CIRCUMFERENCE - (Math.min(100, Math.max(0, result.overallScore)) / 100) * CIRCUMFERENCE;
  const levelName = t.onboarding[LEVEL_NAME_KEY[result.estimatedLevel]];
  const levelEncouragement = t.onboarding[LEVEL_ENCOURAGEMENT_KEY[result.estimatedLevel]];

  return (
    <div className="bg-white dark:bg-ink-900 rounded-3xl shadow-xl p-6 sm:p-8 text-center space-y-6">
      <div>
        <div className="relative mx-auto w-20 h-20" aria-hidden="true">
          <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
            <Trophy size={34} className="text-blue-600 dark:text-blue-400" />
          </div>
          <span className="absolute -top-1 -left-2 w-2 h-2 rounded-full bg-amber-400" />
          <span className="absolute top-1 -right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="absolute -bottom-1 left-0 w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="absolute bottom-0 -right-1 w-2 h-2 rounded-full bg-rose-400" />
        </div>
        <h1 className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
          {t.onboarding.resultTitle}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.onboarding.resultSubtitle}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl bg-slate-50 dark:bg-ink-800/50 p-5 text-left">
        <div className="relative w-[140px] h-[140px] flex-shrink-0 mx-auto sm:mx-0">
          <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
            <circle
              cx={70}
              cy={70}
              r={RADIUS}
              strokeWidth={STROKE}
              fill="none"
              className="stroke-slate-200 dark:stroke-ink-700"
            />
            <circle
              cx={70}
              cy={70}
              r={RADIUS}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className="stroke-blue-600 dark:stroke-blue-400 transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {result.overallScore}%
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t.onboarding.resultOverallScore}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t.onboarding.resultEstimatedLevel}
          </p>
          <div className="mt-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {result.estimatedLevel}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-bold">
              {levelName}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{levelEncouragement}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.key}
              className="rounded-2xl border border-slate-100 dark:border-ink-700 p-4 text-left"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.accent}`}
                aria-hidden="true"
              >
                <Icon size={16} />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {section.score}%
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-0.5">
                {section.label}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {t.onboarding.resultCorrectCount(section.correct, section.total)}
              </p>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden mt-1.5">
                <div
                  style={{ width: `${section.score}%` }}
                  className={`h-full rounded-full ${section.barClass}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setShowReview(true)}
          disabled={planningState === 'planning'}
          className="flex-1 py-3.5 border-2 border-slate-200 dark:border-ink-700 text-slate-700 dark:text-slate-200 font-extrabold rounded-2xl hover:border-blue-300 dark:hover:border-blue-600/50 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-60"
        >
          {t.onboarding.resultViewDetails}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={planningState === 'planning'}
          className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none transition-all disabled:opacity-80 flex items-center justify-center gap-2"
        >
          {planningState === 'planning' && (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          )}
          {planningState === 'planning'
            ? t.onboarding.resultPreparingRoadmap
            : t.onboarding.resultViewRoadmap}
        </button>
      </div>
    </div>
  );
};

export default ResultStep;
