import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Crown, Flame } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { getStreakLeaderboard, type LeaderboardEntry } from '../../services/streakService';
import CommunityAvatar from '../shared/assistant/community-chat/CommunityAvatar';

const RANK_GLYPH: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Dashboard right-rail preview of the Duo Streak Hall of Fame
// (StreakLeaderboardPage). Self-fetches its own top-3 slice from the same
// GET /streaks/leaderboard the full page uses — no new endpoint, no
// duplicated ranking logic (mirrors AchievementsWidget's own-fetch
// convention). Takes the slot Today's Progress used to occupy in
// UserSidebar; Today's Progress moved down one slot rather than being
// dropped.
const DuoLeaderboardWidget: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // undefined = loading, null = the request failed, array = loaded (top 3,
  // possibly empty if no pair has ever qualified).
  const [entries, setEntries] = useState<LeaderboardEntry[] | null | undefined>(undefined);

  const load = () => {
    setEntries(undefined);
    getStreakLeaderboard()
      .then((result) => setEntries(result.slice(0, 3)))
      .catch(() => setEntries(null));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  return (
    <section
      aria-label={t.widgets.duoLeaderboardTitle}
      className="p-6 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-3xl shadow-sm dark:shadow-xl space-y-4"
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate">
          {t.widgets.duoLeaderboardTitle}
        </span>
      </div>

      {entries === undefined && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-12 rounded-2xl bg-slate-100 dark:bg-ink-950 animate-pulse" />
          ))}
        </div>
      )}

      {entries === null && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-rose-500 dark:text-rose-400">{t.widgets.statsUnavailable}</p>
          <button
            type="button"
            onClick={load}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {t.widgets.statsRetry}
          </button>
        </div>
      )}

      {entries !== undefined && entries !== null && entries.length === 0 && (
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{t.streak.leaderboardEmpty}</p>
      )}

      {entries !== undefined && entries !== null && entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.pairId}>
              <button
                type="button"
                onClick={() => navigate(`/streaks/${entry.pairId}`)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-slate-100 dark:border-ink-700 text-left hover:bg-slate-100 dark:hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span className="w-5 text-center text-sm shrink-0" aria-hidden="true">
                  {RANK_GLYPH[entry.rank] ?? `#${entry.rank}`}
                </span>
                <div className="flex items-center -space-x-2 shrink-0">
                  <div className="ring-2 ring-slate-50 dark:ring-ink-950 rounded-full">
                    <CommunityAvatar name={entry.userA.name} avatarUrl={entry.userA.avatarUrl} size={28} />
                  </div>
                  <div className="ring-2 ring-slate-50 dark:ring-ink-950 rounded-full">
                    <CommunityAvatar name={entry.userB.name} avatarUrl={entry.userB.avatarUrl} size={28} />
                  </div>
                </div>
                <span className="min-w-0 flex-1 text-xs font-bold text-slate-900 dark:text-white truncate">
                  {entry.userA.name} & {entry.userB.name}
                </span>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-500/10 pl-2 pr-1 py-1 text-xs font-black text-orange-600 dark:text-orange-400 tabular-nums">
                  <Flame size={12} className="fill-orange-500" aria-hidden="true" />
                  {t.streak.dayCount(entry.currentStreak)}
                  <ChevronRight size={12} className="text-orange-300 dark:text-orange-500/60" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/streaks/leaderboard"
        className="flex items-center justify-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 pt-1"
      >
        {t.widgets.viewFullLeaderboard}
        <ArrowRight size={12} aria-hidden="true" />
      </Link>
    </section>
  );
};

export default DuoLeaderboardWidget;
