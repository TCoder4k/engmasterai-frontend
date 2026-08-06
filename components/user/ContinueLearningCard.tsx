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
   * Real completion percentage for the featured Grammar course, derived by the
   * SERVER and passed down by UserHome. `null` means "no honest number
   * available" — the bar is then not rendered at all rather than shown at 0.
   */
  progressPercent?: number | null;
  /**
   * Sprint 08 — where the server says this student should resume, if a Grammar
   * course is being featured.
   *
   * `recentActivity` records the last course OPENED, which is not the same as
   * the next lesson to do: a student who opened the course page and then
   * finished lesson 3 elsewhere would be sent back to the course index. The
   * server knows the earliest unfinished lesson; this is that.
   *
   * `null`/absent falls back to the recent-activity path, which is still right
   * for decks, listening and anything else with no server-side continuation.
   */
  grammarContinuePath?: string | null;
  /**
   * The featured Grammar course's title, when it was chosen from server
   * progress rather than from this device's recent activity — a fresh browser
   * has no ring buffer, and used to show nothing at all here.
   */
  grammarFallbackTitle?: string | null;
  /**
   * Sprint 11 Phase 4A — a real, SERVER-COMPUTED "3/5 sentences" for the last
   * Listening recording this student opened.
   *
   * Null whenever there is no honest figure (no recent recording, request
   * failed, or a recording with no sentences). The card then renders no detail
   * line at all, which is what it did before Listening had any progress —
   * never a 0 standing in for a number that could not be fetched.
   */
  listeningDetail?: string | null;
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
// Steps 3/4 read the client-side recent-activity ring buffer, so they are
// DEVICE-LOCAL. Step 2 is server-backed.
//
// SPRINT 08 — STEP 1 NO LONGER DEPENDS ON THE RING BUFFER.
// Recent activity may still choose WHICH Grammar course is featured, because
// "the one you were just looking at" is a genuinely good answer. But when this
// browser has no ring buffer — a new device, a cleared profile — UserHome
// falls back to the first course the SERVER reports as in progress, and the
// destination comes from the server's continuation rule either way. The card
// used to render nothing at all in that case, which is bug 7 on the dashboard.
//
// The design reference shows a 65% progress bar here. It is reproduced with a
// REAL, server-derived figure, and is simply absent when there isn't one.
const ContinueLearningCard: React.FC<ContinueLearningCardProps> = ({
  dueTotal = null,
  progressPercent = null,
  grammarContinuePath = null,
  grammarFallbackTitle = null,
  listeningDetail = null,
}) => {
  const { t } = useTranslation();
  const user = authService.getUser();

  const resolve = (): Resolved | null => {
    if (!user) return null;

    const grammar = getMostRecentActivityOfType(user.id, 'GRAMMAR');
    // Either this device remembers a Grammar course, or the server told us
    // one is in progress. Both are real; only the first is device-local.
    if (grammar || grammarFallbackTitle) {
      return {
        moduleLabel: t.tracks.grammar.label,
        title: grammar?.title ?? grammarFallbackTitle!,
        detail: null,
        // The server's next-lesson target wins over the last page opened.
        path: grammarContinuePath ?? grammar?.path ?? '/grammar',
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
        detail: listeningDetail ?? null,
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
