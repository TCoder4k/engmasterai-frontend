
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mic, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

interface SpeakingHeroProps {
  /** The one isFreeTalk scenario's id — null while loading or if the server genuinely has none. */
  freeTalkId: string | null;
}

// Free Talk is the strongest entry point Speaking Partner has (2026-08-20
// redesign) — it leads the page as a hero instead of sitting in its own
// section below the scenario grid. /mascot/robot.png already bakes in its
// own "Hello! 👋" speech bubble and floating chat icons, so this component
// never renders a second, DOM-drawn bubble on top of it.
const SpeakingHero: React.FC<SpeakingHeroProps> = ({ freeTalkId }) => {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-indigo-100 dark:border-indigo-500/20 bg-white dark:bg-slate-900 shadow-lg dark:shadow-none p-6 sm:p-8 lg:p-10">
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-blue-200 to-indigo-200 dark:from-blue-500/10 dark:to-indigo-500/10 blur-3xl opacity-60"
        aria-hidden="true"
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            <Mic size={13} aria-hidden="true" />
            {t.practice.speakingHeroEyebrow}
          </div>

          <h1 className="mt-4 text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            {t.practice.modeSpeaking}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">
            {t.practice.modeSpeakingDesc}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
              <Zap size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                  {t.practice.speakingHeroStatAvailabilityTitle}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t.practice.speakingHeroStatAvailabilityDesc}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
              <Sparkles size={18} className="text-blue-500 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                  {t.practice.speakingHeroStatFeedbackTitle}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t.practice.speakingHeroStatFeedbackDesc}
                </p>
              </div>
            </div>
          </div>

          {freeTalkId && (
            <Link
              to={`/practice/speaking/${freeTalkId}`}
              className="mt-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-[#00A3FF] dark:to-blue-600 px-5 py-4 text-white shadow-lg shadow-blue-500/20 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 max-w-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Mic size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-extrabold">{t.practice.speakingHeroCtaTitle}</span>
                <span className="block text-xs font-medium text-blue-50/80">
                  {t.practice.speakingHeroCtaSubtitle}
                </span>
              </span>
              <ArrowRight size={20} className="shrink-0" aria-hidden="true" />
            </Link>
          )}

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" aria-hidden="true" />
              {t.practice.speakingHeroTrustSafe}
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" aria-hidden="true" />
              {t.practice.speakingHeroTrustOptimized}
            </div>
          </div>
        </div>

        <div className="relative hidden lg:flex items-center justify-center">
          <img
            src="/mascot/robot.png"
            alt=""
            className="relative z-10 w-full max-h-[280px] object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default SpeakingHero;
