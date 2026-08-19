import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, MessageCircle, ChevronRight, Sparkles } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import BackButton from '../../shared/BackButton';
import EmptyState from '../../shared/EmptyState';
import ErrorState from '../../shared/ErrorState';
import Skeleton from '../../shared/Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { getSpeakingScenarios, SpeakingScenarioCard } from '../../../services/speakingService';

// Speaking Partner (Phase 1+2) — /practice/speaking, the catalog.
//
// Same read-only, server-driven discipline as ListeningCatalogPage: the
// client never filters for visibility (a scenario in the response IS
// visible; nothing here decides that), and an error is never rendered as an
// empty catalog.
//
// TWO SECTIONS, not one flat grid: "Luyện theo bối cảnh" for scenario-based
// practice, and "Nói chuyện tự do" for the one open-topic Free Talk entry
// (SpeakingScenario.isFreeTalk — see the backend schema comment). The split
// is purely presentational; a Free Talk scenario is still an ordinary
// scenario card underneath, linking to the same /practice/speaking/:id
// route as any other — SpeakingScenarioPage is what makes it a genuine
// one-tap entry, by auto-redirecting once it sees isFreeTalk with exactly
// one exercise.
const SpeakingCatalogPage: React.FC = () => {
  const { t, language } = useTranslation();
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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top of the Speaking tree — the one, unambiguous "leave Speaking
            entirely" action, so a student never needs the browser Back
            button to switch to the other Nghe-nói mode. */}
        <BackButton to="/practice" label={t.practice.backToModeHub} />

        <div>
          <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.practice.modeSpeaking}
          </h2>
          <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 mt-2.5 rounded-full" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">
            {t.practice.modeSpeakingDesc}
          </p>
        </div>

        {error && <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />}

        {!error && scenarios === null && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        )}

        {!error && scenarios !== null && scenarios.length === 0 && (
          <EmptyState icon={<Mic size={32} />} message={t.practice.speakingNoScenarios} />
        )}

        {!error && scenarios !== null && scenarios.length > 0 && (
          <>
            {contextScenarios.length > 0 && (
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {t.practice.speakingContextSectionTitle}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  {t.practice.speakingContextSectionDesc}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {contextScenarios.map((scenario) => (
                    <Link
                      key={scenario.id}
                      to={`/practice/speaking/${scenario.id}`}
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-blue-200 dark:hover:border-blue-500/40 hover:shadow-md transition-all flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <MessageCircle size={20} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {language === 'vi' ? scenario.nameVi : scenario.name}
                        </p>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                          {scenario.level}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {freeTalkScenario && (
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {t.practice.speakingFreeTalkSectionTitle}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  {t.practice.speakingFreeTalkSectionDesc}
                </p>
                <Link
                  to={`/practice/speaking/${freeTalkScenario.id}`}
                  className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-500/30 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex items-center gap-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center shrink-0">
                    <MessageCircle size={26} aria-hidden="true" />
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-white dark:bg-slate-900 text-blue-500 p-0.5">
                      <Sparkles size={14} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {t.practice.speakingFreeTalkCardTitle}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                        {t.practice.speakingFreeTalkBadge}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                      {t.practice.speakingFreeTalkCardDesc}
                    </p>
                  </div>
                  <span className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-500 dark:bg-[#00A3FF] text-white text-xs font-bold whitespace-nowrap">
                    {t.practice.speakingFreeTalkCta}
                  </span>
                </Link>
              </div>
            )}

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
