import React from 'react';
import { Trophy } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { AchievementKey } from '../../services/gamificationService';
import { useGamification } from '../shared/GamificationProvider';

// Sprint 10 — the Achievements widget, REAL.
//
// It was the last mock on the dashboard's right rail apart from Daily Goal
// (which stays placeholder because no time-on-task signal exists anywhere).
// MOCK_ACHIEVEMENTS is deleted and the "sample data" marker goes with it — a
// placeholder label on a true figure is its own kind of lie, which is why
// Sprint 09 removed the markers from the two widgets it made real rather than
// leaving them "just in case".
//
// The catalog is CLOSED at six for Sprint 10 and the server always returns all
// six, locked ones included, so this renders a stable list rather than a list
// that grows as the student earns things.

// Per-badge presentation. Deliberately keyed by the server's AchievementKey so
// a key with no entry here is a compile error, not a blank tile — the same
// closed-set discipline the backend's catalog uses.
const BADGE_STYLES: Record<AchievementKey, { glyph: string; tile: string }> = {
  FIRST_STAGE: {
    glyph: '⭐',
    tile: 'bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30',
  },
  FIRST_QUIZ_PASS: {
    glyph: '✅',
    tile: 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  },
  FIRST_MASTERED_WORD: {
    glyph: '📚',
    tile: 'bg-cyan-100 text-cyan-600 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
  },
  STREAK_3: {
    glyph: '3',
    tile: 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
  },
  STREAK_7: {
    glyph: '7',
    tile: 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  XP_500: {
    glyph: '500',
    tile: 'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30',
  },
};

const AchievementsWidget: React.FC = () => {
  const { t } = useTranslation();
  const gamification = useGamification();

  const profile = gamification?.profile;
  const isLoading = profile === undefined;
  const hasFailed = profile === null;

  return (
    <section
      aria-label={t.widgets.achievements}
      className="p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-3xl shadow-sm dark:shadow-xl space-y-4"
    >
      <div className="flex items-center gap-2">
        <Trophy
          className="w-4 h-4 text-amber-500 dark:text-amber-400"
          aria-hidden="true"
        />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          {t.widgets.achievements}
        </span>
      </div>

      {isLoading && (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-14 rounded-2xl bg-slate-100 dark:bg-ink-950 animate-pulse"
            />
          ))}
        </div>
      )}

      {hasFailed && (
        <div className="space-y-2">
          {/* Never an empty trophy case: a student who has earned badges must
              not be told they have none because a request failed. */}
          <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">
            {t.widgets.statsUnavailable}
          </p>
          {gamification && (
            <button
              type="button"
              onClick={gamification.refresh}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t.widgets.statsRetry}
            </button>
          )}
        </div>
      )}

      {profile && (
        <ul className="space-y-3">
          {profile.achievements.map((achievement) => {
            const style = BADGE_STYLES[achievement.key];
            const unlocked = achievement.unlockedAt !== null;
            return (
              <li
                key={achievement.key}
                className={`flex items-center gap-3 p-3 border rounded-2xl transition-opacity ${
                  unlocked
                    ? 'bg-slate-50 dark:bg-ink-950 border-slate-200 dark:border-ink-700'
                    : 'bg-transparent border-dashed border-slate-200 dark:border-ink-700 opacity-60'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 font-black text-xs ${
                    unlocked
                      ? style.tile
                      : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-ink-950 dark:text-slate-600 dark:border-ink-700'
                  }`}
                  aria-hidden="true"
                >
                  {style.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white">
                    {t.achievements[achievement.key]}
                    {/* Locked/unlocked is carried by TEXT, never by opacity
                        and colour alone. */}
                    <span className="sr-only">
                      {' — '}
                      {unlocked
                        ? t.widgets.achievementUnlocked
                        : t.widgets.achievementLocked}
                    </span>
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t.achievements[`${achievement.key}_HINT` as const]}
                    {achievement.progress &&
                      ` · ${achievement.progress.current}/${achievement.progress.target}`}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                  +{achievement.xp}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AchievementsWidget;
