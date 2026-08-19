import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Mic } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import BackButton from '../../shared/BackButton';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSpeakingScenario, SpeakingScenarioDetail } from '../../../services/speakingService';

// Speaking Partner (Phase 1+2) — /practice/speaking/:scenarioId.
//
// Lists the scenario's exercises. Auto-advancing through them with a
// "Bài luyện 1/5" counter is Phase 3 polish (needs the UI the reference
// screenshot shows) — this pass, finishing one exercise returns here to
// pick the next manually.
const SpeakingScenarioPage: React.FC = () => {
  const { t, language } = useTranslation();
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [scenario, setScenario] = useState<SpeakingScenarioDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!scenarioId) return undefined;
    let cancelled = false;
    setScenario(null);
    setError(null);
    getSpeakingScenario(scenarioId)
      .then((data) => {
        if (!cancelled) setScenario(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, reloadToken]);

  // Free Talk has exactly one exercise and no real "choose one" step — the
  // catalog's own CTA already promises a one-tap entry into the
  // conversation, so this page's job for that one scenario is to redirect
  // straight through, not show a one-item list. `replace` so a browser-Back
  // from the session skips past this page too, matching what would have
  // happened had the student never seen it.
  if (!error && scenario && scenario.isFreeTalk && scenario.exercises.length === 1) {
    return (
      <Navigate to={`/practice/speaking/${scenarioId}/${scenario.exercises[0].id}`} replace />
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <BackButton to="/practice/speaking" label={t.practice.speakingBackToCatalog} />

        {error && <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />}

        {!error && scenario === null && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        )}

        {!error && scenario && (
          <>
            <div>
              <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {language === 'vi' ? scenario.nameVi : scenario.name}
              </h2>
              {/* Language-aware (2026-08-20 fix) — name/description now
                  follow the app's own language toggle together, instead of
                  always showing nameVi as the heading with an English
                  description underneath regardless of language. */}
              {(() => {
                const description = language === 'vi' ? scenario.descriptionVi : scenario.description;
                return (
                  (scenario.level || description) && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                      {scenario.level && (
                        <span className="inline-block align-middle mr-1.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-1.5 py-0.5">
                          {scenario.level}
                        </span>
                      )}
                      {description}
                    </p>
                  )
                );
              })()}
            </div>

            {scenario.exercises.length === 0 ? (
              <EmptyState icon={<Mic size={32} />} message={t.practice.speakingNoExercises} />
            ) : (
              <div className="space-y-3">
                {scenario.exercises.map((exercise, index) => (
                  <Link
                    key={exercise.id}
                    to={`/practice/speaking/${scenarioId}/${exercise.id}`}
                    className="block bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-blue-200 dark:hover:border-blue-500/40 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wide">
                      {index + 1}
                    </p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                      {language === 'vi' ? exercise.titleVi : exercise.title}
                    </p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                      {exercise.level}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default SpeakingScenarioPage;
