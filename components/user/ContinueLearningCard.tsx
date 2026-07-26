import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookMarked, BookOpen, Headphones } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { authService } from '../../services/authService';
import { getMostRecentActivity, getMostRecentActivityOfType } from '../../services/recentActivity';

interface ContinueLearningCardProps {
  // Summed due words from GET /learning/libraries/progress, or null when it
  // is not known yet (loading / failed). Never treated as 0 when null.
  dueTotal?: number | null;
}

type Resolved = {
  moduleLabel: string;
  title: string;
  detail: string | null;
  path: string;
  icon: React.ReactNode;
};

// Sprint 05 — Continue Learning is now module-aware instead of purely
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
// The design reference shows a 65% progress bar in this card. It is not
// reproduced: there is no lesson-progress API, so no honest percentage
// exists. In the review variant that slot carries the real due count instead.
const ContinueLearningCard: React.FC<ContinueLearningCardProps> = ({ dueTotal = null }) => {
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
        icon: <BookOpen size={40} className="text-white/90" />,
      };
    }

    if (dueTotal !== null && dueTotal > 0) {
      return {
        moduleLabel: t.tracks.vocabulary.label,
        title: t.dashboard.continueReviewTitle,
        detail: `${dueTotal} ${t.dashboard.continueWordsDue}`,
        path: '/practice/review',
        icon: <BookMarked size={40} className="text-white/90" />,
      };
    }

    const listening = getMostRecentActivityOfType(user.id, 'LISTENING');
    if (listening) {
      return {
        moduleLabel: t.tracks.listening.label,
        title: listening.title,
        detail: null,
        path: listening.path,
        icon: <Headphones size={40} className="text-white/90" />,
      };
    }

    const recent = getMostRecentActivity(user.id);
    if (recent) {
      return {
        moduleLabel: t.dashboard.continue,
        title: recent.title,
        detail: null,
        path: recent.path,
        icon: <BookOpen size={40} className="text-white/90" />,
      };
    }

    return null;
  };

  const resolved = resolve();

  return (
    <section aria-label={t.dashboard.continueLearning}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
          {t.dashboard.continueLearning}
        </h2>
        <Link
          to="/grammar"
          className="flex items-center space-x-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-1"
        >
          <span>{t.dashboard.viewRoadmap}</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-100/60 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          className="w-full h-28 sm:w-36 sm:h-24 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-100 dark:shadow-none"
          aria-hidden="true"
        >
          {resolved ? resolved.icon : <BookOpen size={40} className="text-white/90" />}
        </div>

        {resolved ? (
          <>
            <div className="flex-1 min-w-0">
              <span className="inline-block text-[11px] font-bold text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/20 px-2.5 py-1 rounded-md uppercase">
                {resolved.moduleLabel}
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-2 truncate">
                {resolved.title}
              </h3>
              {resolved.detail && (
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {resolved.detail}
                </p>
              )}
            </div>
            <Link
              to={resolved.path}
              className="inline-flex items-center justify-center flex-shrink-0 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              {t.dashboard.continue}
            </Link>
          </>
        ) : (
          <div className="flex-1 min-w-0">
            <span className="inline-block text-[11px] font-bold text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/20 px-2.5 py-1 rounded-md">
              {t.common.comingSoon}
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-2">
              {t.dashboard.noLearningActivity}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
              {t.dashboard.continueLearningHint}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ContinueLearningCard;
