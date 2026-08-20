
import React, { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import BackButton from '../../shared/BackButton';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSpeakingScenarios, SpeakingScenarioCard } from '../../../services/speakingService';
import SpeakingHero from './SpeakingHero';
import SpeakingScenarioGrid from './SpeakingScenarioGrid';

// Speaking Partner (Phase 1+2) — /practice/speaking, the catalog.
//
// Same read-only, server-driven discipline as ListeningCatalogPage: the
// client never filters for visibility (a scenario in the response IS
// visible; nothing here decides that), and an error is never rendered as an
// empty catalog.
//
// HERO-LED LAYOUT (2026-08-20 redesign) — Free Talk (SpeakingScenario.
// isFreeTalk) is the strongest, most-used entry point, so it leads the page
// as SpeakingHero instead of sitting in its own section below the scenario
// grid. It is still an ordinary scenario row underneath, linking to the
// same /practice/speaking/:id route as any other — SpeakingScenarioPage is
// what makes it a genuine one-tap entry, by auto-redirecting once it sees
// isFreeTalk with exactly one exercise.
const SpeakingCatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const [scenarios, setScenarios] = useState<SpeakingScenarioCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setScenarios(null);
    setError(null);
    getSpeakingScenarios()
      .then((data) => {
        if (!cancelled) setScenarios(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const contextScenarios = scenarios?.filter((scenario) => !scenario.isFreeTalk) ?? [];
  const freeTalkScenario = scenarios?.find((scenario) => scenario.isFreeTalk) ?? null;

  return (
    <StudentLayout>
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Top of the Speaking tree — the one, unambiguous "leave Speaking
            entirely" action, so a student never needs the browser Back
            button to switch to the other Nghe-nói mode. */}
        <BackButton to="/practice" label={t.practice.backToModeHub} />

        {error && <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />}

        {!error && scenarios === null && (
          <div className="space-y-6">
            <Skeleton className="h-[280px] rounded-[28px]" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[84px]" />
              ))}
            </div>
          </div>
        )}

        {!error && scenarios !== null && scenarios.length === 0 && (
          <EmptyState icon={<Mic size={32} />} message={t.practice.speakingNoScenarios} />
        )}

        {!error && scenarios !== null && scenarios.length > 0 && (
          <>
            <SpeakingHero freeTalkId={freeTalkScenario?.id ?? null} />

            {contextScenarios.length > 0 && <SpeakingScenarioGrid scenarios={contextScenarios} />}

            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              {t.practice.speakingCatalogFooterHint}
            </p>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default SpeakingCatalogPage;
