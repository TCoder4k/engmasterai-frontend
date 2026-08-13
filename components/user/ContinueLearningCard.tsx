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
// A REAL, server-derived progress percentage is shown when there is one, and
// simply absent when there isn't.
//
// Restyled to a single compact "resume" row rather than a hero banner: this
// card sits between the vocabulary banner and the roadmap, and giving it the
// same visual weight as either would make every section fight for attention
// instead of establishing which one is primary.
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
        icon: <BookOpen className="w-6 h-6" aria-hidden="true" />,
      };
    }

    if (dueTotal !== null && dueTotal > 0) {
      return {
        moduleLabel: t.tracks.vocabulary.label,
        title: t.dashboard.continueReviewTitle,
        detail: `${dueTotal} ${t.dashboard.continueWordsDue}`,
        path: '/practice/review',
        icon: <BookMarked className="w-6 h-6" aria-hidden="true" />,
      };
    }

    const listening = getMostRecentActivityOfType(user.id, 'LISTENING');
    if (listening) {
      return {
        moduleLabel: t.tracks.listening.label,
        title: listening.title,
        detail: listeningDetail ?? null,
        path: listening.path,
        icon: <Headphones className="w-6 h-6" aria-hidden="true" />,
      };
    }

    const recent = getMostRecentActivity(user.id);
    if (recent) {
      return {
        moduleLabel: t.dashboard.continue,
        title: recent.title,
        detail: null,
        path: recent.path,
        icon: <BookOpen className="w-6 h-6" aria-hidden="true" />,
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
        {/* A same-page anchor, not a route — the roadmap is multi-pillar
            (Grammar + Vocabulary + Listening) now, so a Link to /grammar
            would misleadingly suggest "roadmap" means only the Grammar
            module. Scrolls to RoadmapCard's wrapper (UserHome.tsx) instead;
            no dedicated roadmap route exists outside onboarding. */}
        <a
          href="#personal-roadmap"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors rounded-lg px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.dashboard.viewRoadmap}
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors">
        {/* sm:contents removes this wrapper from layout at 640px+, so icon +
            text become the same 2 direct flex children they are today
            (alongside the CTA below) — phones get icon+title grouped as one
            row above a full-width CTA instead. */}
        <div className="flex items-center gap-3 sm:contents">
          <span
            className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            {resolved ? resolved.icon : <BookOpen className="w-6 h-6" />}
          </span>

          <div className="min-w-0 flex-1">
            {resolved ? (
              <>
                <span className="inline-block px-2.5 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 text-[10px] font-bold rounded-full mb-1">
                  {resolved.moduleLabel}
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {resolved.title}
                </h3>
                {resolved.detail && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {resolved.detail}
                  </p>
                )}
                {/* Rendered only when a true percentage exists. */}
                {showProgress && (
                  <div className="flex items-center gap-2 mt-1.5 max-w-none sm:max-w-[220px]">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                      {t.dashboard.progress}
                    </span>
                    <div
                      className="flex-1 h-1.5 bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={progressPercent ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t.dashboard.progress}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      {progressPercent}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 dark:bg-ink-800 dark:text-slate-300 dark:border-ink-700 text-[10px] font-bold rounded-full mb-1">
                  {t.common.comingSoon}
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {t.dashboard.noLearningActivity}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {t.dashboard.continueLearningHint}
                </p>
              </>
            )}
          </div>
        </div>

        {resolved && (
          <Link
            to={resolved.path}
            className="w-full sm:w-auto justify-center flex-shrink-0 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {t.dashboard.continue}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
};

export default ContinueLearningCard;
