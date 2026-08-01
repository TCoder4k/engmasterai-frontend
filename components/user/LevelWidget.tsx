import React from 'react';
import { Gem } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useGamification } from '../shared/GamificationProvider';

const HEXAGON_CLIP = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';

// Sprint 10 — the student's level, in the desktop sidebar.
//
// This replaces a placeholder that read "Coming soon" beside a comment
// claiming "totalPoints/level exist on the User model but no API returns them
// yet". The comment was WRONG — GET /users/me has returned both since Sprint
// 01. The numbers were zero because nothing in the product ever awarded them,
// which is the gap Sprint 10 closes.
//
// THREE STATES, NEVER A ZERO STANDING IN FOR A FAILURE. `undefined` is a
// skeleton, `null` is an error with a retry, and only a real payload renders
// numbers. Showing "Level 1 · 0 XP" to a student at level 6 whose request
// failed is not an empty state, it is a false statement — the rule Sprint 08
// set for course progress and Sprint 09 for the dashboard.
//
// Data comes from GamificationProvider, never from localStorage: authService
// stores the user at login and never refreshes it, so `user.totalPoints` would
// be frozen at sign-in and the widget would look broken.
const LevelWidget: React.FC = () => {
  const { t } = useTranslation();
  const gamification = useGamification();

  // Outside the provider (an admin route, or a test rendering the sidebar in
  // isolation) there is nothing to show, and nothing to apologise for.
  if (!gamification) return null;

  const { profile, refresh } = gamification;

  return (
    <section
      aria-label={t.widgets.level}
      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
    >
      <div className="flex items-center space-x-3 mb-4">
        <div
          className="w-12 h-12 bg-blue-600 flex items-center justify-center text-white flex-shrink-0"
          style={{ clipPath: HEXAGON_CLIP }}
          aria-hidden="true"
        >
          <Gem size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {t.widgets.level}
          </p>
          {profile === undefined && (
            <span
              className="block mt-1 h-4 w-16 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse"
              aria-hidden="true"
            />
          )}
          {profile === null && (
            <p className="text-sm font-extrabold text-rose-500 dark:text-rose-400">
              {t.widgets.statsUnavailable}
            </p>
          )}
          {profile && (
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t.widgets.levelNumber.replace('{level}', String(profile.xp.level))}
            </p>
          )}
        </div>
      </div>

      {profile === null ? (
        <button
          type="button"
          onClick={refresh}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t.widgets.statsRetry}
        </button>
      ) : (
        <>
          <div
            className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
            // The bar is only a progressbar once it has a real value to
            // report; while loading it is decoration, and announcing "0%" to a
            // screen reader would be the same lie as rendering it.
            {...(profile
              ? {
                  role: 'progressbar' as const,
                  'aria-valuenow': profile.xp.percent,
                  'aria-valuemin': 0,
                  'aria-valuemax': 100,
                  'aria-label': t.widgets.xpToNextLevel.replace(
                    '{xp}',
                    String(profile.xp.toNextLevel),
                  ),
                }
              : { 'aria-hidden': true })}
          >
            {profile && (
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${profile.xp.percent}%` }}
              />
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-2 tabular-nums">
            {profile
              ? `${profile.xp.totalXp} XP · ${t.widgets.xpToNextLevel.replace(
                  '{xp}',
                  String(profile.xp.toNextLevel),
                )}`
              : ' '}
          </p>
        </>
      )}
    </section>
  );
};

export default LevelWidget;
