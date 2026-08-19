import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../user/StudentLayout';
import { useTranslation } from '../../i18n/useTranslation';
import { Headphones, Mic, ArrowRight, AudioLines, MessageCircle, Lightbulb } from 'lucide-react';
import { getListeningCatalog } from '../../services/listeningService';

// /practice — the shared "Nghe - nói" (Listening/Shadowing + Speaking
// Partner) mode-selection hub. Realigned (2026-08-19) from an earlier state
// where this page was an internal-compatibility-only route reachable by no
// primary nav item: the "Nghe - nói" sidebar/bottom-nav entry now points
// HERE first. Redesigned (2026-08-20) into a compact two-card layout
// matching the product owner's own reference screenshot exactly — icon,
// title, a one-line dot-separated tagline, and a chip + CTA row — replacing
// the earlier bulleted-checklist card body and the "other practice"
// section (Vocabulary/Review, removed the same day as clutter on a page
// whose whole point is Nghe-nói mode selection).
const PracticeHubPage: React.FC = () => {
  const { t } = useTranslation();

  // The chip's "N bài luyện" figure is a REAL count, not a guess — fetched
  // from the same catalog endpoint the Listening/Shadowing pages use,
  // filtered to shadowing-capable content only. Stays hidden (never a
  // fabricated placeholder) until the real number is in, and just as
  // quietly stays hidden on a failed fetch — a decorative chip is not worth
  // an error state on the whole hub page.
  const [shadowingLessonCount, setShadowingLessonCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getListeningCatalog({ mode: 'SHADOWING', limit: 1 })
      .then((res) => {
        if (!cancelled) setShadowingLessonCount(res.meta.total);
      })
      .catch(() => {
        // Best-effort — see the state's own comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Headphones size={24} aria-hidden="true" />
          </div>
          <h2 className="text-[22px] font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {t.nav.audioPractice}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mb-4">
              <Headphones size={26} aria-hidden="true" />
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100">
              {t.practice.modeListeningCardTitle}
            </p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5">
              {t.practice.modeListeningTagline}
            </p>
            <div className="mt-6 flex items-center gap-2">
              {shadowingLessonCount !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1.5">
                  <AudioLines size={14} aria-hidden="true" />
                  {t.practice.modeListeningLessonCount(shadowingLessonCount)}
                </span>
              )}
              <Link
                to="/practice/listening"
                aria-label={t.practice.modeListeningCardCta}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-sm px-4 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {t.practice.startCta}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="relative w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0 mb-4">
              <Mic size={26} aria-hidden="true" />
              <span className="absolute -top-1.5 -right-1.5 rounded-full bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5">
                AI
              </span>
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100">
              {t.practice.modeSpeakingCardTitle}
            </p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5">
              {t.practice.modeSpeakingTagline}
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold px-3 py-1.5">
                <MessageCircle size={14} aria-hidden="true" />
                {t.practice.modeSpeakingChipLabel}
              </span>
              <Link
                to="/practice/speaking"
                aria-label={t.practice.modeSpeakingCardCta}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-blue-500 dark:bg-[#00A3FF] text-white font-bold text-sm px-4 py-2 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {t.practice.startCta}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-5 py-4">
          <Lightbulb size={20} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <span className="font-extrabold">{t.practice.hubTipTitle}</span> — {t.practice.hubTipBody}
          </p>
        </div>
      </div>
    </StudentLayout>
  );
};

export default PracticeHubPage;
