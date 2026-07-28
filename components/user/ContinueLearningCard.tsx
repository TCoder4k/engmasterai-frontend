import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookMarked, BookOpen, ChevronRight, Headphones, Play } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { authService } from '../../services/authService';
import { getMostRecentActivity, getMostRecentActivityOfType } from '../../services/recentActivity';

interface ContinueLearningCardProps {
  // Summed due words from GET /learning/libraries/progress, or null when it
  // is not known yet (loading / failed). Never treated as 0 when null.
  dueTotal?: number | null;
  /**
   * Real completion percentage for the resolved Grammar course, computed by
   * UserHome from services/lessonProgress. `null` means "no honest number
   * available" — the bar is then not rendered at all rather than shown at 0.
   */
  progressPercent?: number | null;
}

type Resolved = {
  moduleLabel: string;
  title: string;
  detail: string | null;
  path: string;
  icon: React.ReactNode;
};

// Sprint 05 — Continue Learning is module-aware instead of purely
// recency-based. Priority order, which is a product decision, not a
// technical one:
//
//   1. Grammar — the module the product leads with. If a student has a
//      Grammar lesson or course open, that is what "continue" means.
//   2. Vocabulary review — real due words waiting (server-authoritative).
//   3. Listening.
//   4. Whatever was opened most recently, module unknown or otherwise. This
//      is the pre-Sprint-05 behaviour and covers entries already sitting in
//      users' localStorage without a `courseType`.
//   5. The original honest empty state.
//
// Steps 1/3/4 read the client-side recent-activity ring buffer, so they are
// DEVICE-LOCAL: a student signing in on a new browser sees step 2 or the
// empty state, never a wrong lesson. Step 2 is the only server-backed one.
//
// The design reference shows a 65% progress bar here. It is now reproduced
// with a REAL figure — Sprint 06 shipped per-lesson stage progress, so
// UserHome can compute the resolved course's true completion — and it is
// simply absent whenever that cannot be computed.
const ContinueLearningCard: React.FC<ContinueLearningCardProps> = ({
  dueTotal = null,
  progressPercent = null,
}) => {
  const { t } = useTranslation();
  const user = authService.getUser();

  const resolve = (): Resolved | null => {
    if (!user) return null;

    const grammar = getMostRecentActivityOfType(user.id, 'GRAMMAR');
    if (grammar) {
      return {
        moduleLabel: t.tracks.grammar.label,
        title: grammar.title,
        detail: null,
        path: grammar.path,
        icon: <BookOpen className="w-8 h-8" aria-hidden="true" />,
      };
    }

    if (dueTotal !== null && dueTotal > 0) {
      return {
        moduleLabel: t.tracks.vocabulary.label,
        title: t.dashboard.continueReviewTitle,
        detail: `${dueTotal} ${t.dashboard.continueWordsDue}`,
        path: '/practice/review',
        icon: <BookMarked className="w-8 h-8" aria-hidden="true" />,
      };
    }

    const listening = getMostRecentActivityOfType(user.id, 'LISTENING');
    if (listening) {
      return {
        moduleLabel: t.tracks.listening.label,
        title: listening.title,
        detail: null,
        path: listening.path,
        icon: <Headphones className="w-8 h-8" aria-hidden="true" />,
      };
    }

    const recent = getMostRecentActivity(user.id);
    if (recent) {
      return {
        moduleLabel: t.dashboard.continue,
        title: recent.title,
        detail: null,
        path: recent.path,
        icon: <BookOpen className="w-8 h-8" aria-hidden="true" />,
      };
    }

    return null;
  };

  const resolved = resolve();
  const showProgress = resolved !== null && progressPercent !== null;

  return (
    <section aria-label={t.dashboard.continueLearning} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Play className="w-4 h-4 text-blue-500 fill-blue-500 dark:text-blue-400 dark:fill-blue-400" aria-hidden="true" />
          {t.dashboard.continueLearning}
        </h2>
        <Link
          to="/grammar"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors rounded-lg px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.dashboard.viewRoadmap}
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="group relative overflow-hidden rounded-3xl p-6 shadow-lg dark:shadow-2xl space-y-4 border transition-all bg-gradient-to-r from-blue-50 via-white to-blue-50/60 border-blue-200 hover:border-blue-300 dark:from-blue-950 dark:via-ink-900 dark:to-ink-850 dark:border-blue-500/30 dark:hover:border-blue-500/50">
        <div
          className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <span
              className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-xl shrink-0 group-hover:scale-105 transition-transform duration-300"
              aria-hidden="true"
            >
              <span className="w-full h-full bg-white dark:bg-ink-950 rounded-[14px] flex flex-col items-center justify-center gap-1 p-2 text-blue-600 dark:text-blue-400">
                {resolved ? resolved.icon : <BookOpen className="w-8 h-8" />}
                <span className="text-[9px] font-black text-blue-500 dark:text-blue-300 tracking-wider uppercase truncate max-w-full">
                  {resolved ? resolved.moduleLabel : t.tracks.grammar.label}
                </span>
              </span>
            </span>

            {resolved ? (
              <div className="space-y-1.5 min-w-0">
                <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 text-[10px] font-bold rounded-full">
                  {resolved.moduleLabel}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors truncate">
                  {resolved.title}
                </h3>
                {resolved.detail && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {resolved.detail}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 min-w-0">
                <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 text-[10px] font-bold rounded-full">
                  {t.common.comingSoon}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {t.dashboard.noLearningActivity}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  {t.dashboard.continueLearningHint}
                </p>
              </div>
            )}
          </div>

          {resolved && (
            <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-3 shrink-0">
              {/* Rendered only when a true percentage exists. */}
              {showProgress && (
                <div className="w-full sm:w-44 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-400">{t.dashboard.progress}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-black">{progressPercent}%</span>
                  </div>
                  <div
                    className="w-full h-2.5 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-ink-700"
                    role="progressbar"
                    aria-valuenow={progressPercent ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t.dashboard.progress}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <Link
                to={resolved.path}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {t.dashboard.continue}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ContinueLearningCard;
