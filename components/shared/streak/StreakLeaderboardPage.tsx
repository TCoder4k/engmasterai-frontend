import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Flame, Heart } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import BackButton from '../BackButton';
import EmptyState from '../EmptyState';
import ErrorState from '../ErrorState';
import Skeleton from '../Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { handleAuthError } from '../../../services/apiError';
import { getStreakLeaderboard, type LeaderboardEntry } from '../../../services/streakService';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';

type LoadState = 'loading' | 'ready' | 'error';

// Thresholds are purely presentational — a deterministic label computed
// from a real number (currentStreak), applied uniformly to every pair by
// the same rule. NOT the same thing as the mockup's per-pair "motto"/
// "relationshipTag": those had no possible honest source anywhere in this
// app and were deliberately left out (confirmed with the user) rather than
// invented. Mirrors the MILESTONES list's spirit without needing to match
// it exactly, since this is flavor text, not a notification trigger.
const flameTier = (t: ReturnType<typeof useTranslation>['t'], days: number): string => {
  if (days >= 100) return t.streak.flameTier100;
  if (days >= 30) return t.streak.flameTier30;
  if (days >= 7) return t.streak.flameTier7;
  return t.streak.flameTier1;
};

const PairAvatars: React.FC<{ entry: LeaderboardEntry; size: number }> = ({ entry, size }) => (
  <div className="flex items-center justify-center gap-1 sm:gap-2">
    <CommunityAvatar name={entry.userA.name} avatarUrl={entry.userA.avatarUrl} size={size} />
    <Heart size={11} className="text-rose-400 fill-rose-400 shrink-0" aria-hidden="true" />
    <CommunityAvatar name={entry.userB.name} avatarUrl={entry.userB.avatarUrl} size={size} />
  </div>
);

// Sits in a THREE-column grid at every breakpoint, phones included — a
// literal podium reads left-to-right, not stacked. Sizing is mobile-first
// and compact throughout (small avatars, clamped 2-line names, tight
// padding) rather than shrinking only via a `md:` breakpoint: on a ~360px
// phone, three of these still need to fit side by side. Previously
// `grid-cols-1 md:grid-cols-3` — on phones that stacked three full-height
// desktop-sized cards, so a user saw only 1.5 of them before scrolling past
// the rest of the board entirely.
const PodiumCard: React.FC<{
  entry: LeaderboardEntry;
  t: ReturnType<typeof useTranslation>['t'];
  // undefined for anyone else's pair — the backend 403s a non-participant
  // reading streak detail, so this deliberately renders as a plain,
  // non-interactive card rather than a dead/erroring link. Only the
  // viewer's own pair (entry.isCurrentUserPair) is ever passed a real
  // handler, from the call site below.
  onClick: (() => void) | undefined;
}> = ({ entry, t, onClick }) => {
  const isChampion = entry.rank === 1;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`block w-full text-center space-y-1.5 sm:space-y-3 rounded-2xl sm:rounded-3xl p-2 sm:p-4 md:p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
        isChampion
          ? 'md:-translate-y-3 bg-gradient-to-b from-[#1C182A] via-[#151B2E] to-[#0F1424] border-2 border-amber-400 shadow-2xl shadow-amber-500/20 text-white'
          : `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${
              entry.isCurrentUserPair ? 'ring-2 ring-orange-400' : ''
            }`
      }`}
    >
      <div className="flex items-center justify-center">
        {isChampion ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 sm:gap-1.5 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[8px] sm:text-[11px] whitespace-nowrap">
            <Crown size={11} className="fill-slate-950 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t.streak.leaderboardChampionBadge}</span>
            <span className="sm:hidden">👑</span>
          </span>
        ) : (
          <span
            className={`px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black whitespace-nowrap ${
              entry.rank === 2
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}
          >
            {entry.rank === 2 ? '🥈' : '🥉'} #{entry.rank}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center">
        <PairAvatars entry={entry} size={isChampion ? 40 : 32} />
      </div>

      <h3
        className={`font-black text-center text-[10px] leading-tight sm:text-sm md:text-base line-clamp-2 break-words ${
          isChampion ? 'text-white' : 'text-slate-900 dark:text-white'
        }`}
      >
        {entry.userA.name} & {entry.userB.name}
      </h3>

      {entry.isCurrentUserPair && (
        <p
          className={`text-center text-[8px] sm:text-[11px] font-bold ${
            isChampion ? 'text-amber-300' : 'text-orange-500 dark:text-orange-400'
          }`}
        >
          {t.streak.leaderboardYourPair}
        </p>
      )}

      <div
        className={`p-1 sm:p-2 md:p-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1 sm:gap-2 font-black ${
          isChampion
            ? 'bg-amber-500/20 border border-amber-400/50 text-white text-xs sm:text-lg md:text-2xl'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] sm:text-base md:text-xl'
        }`}
      >
        <Flame
          size={isChampion ? 13 : 11}
          className="text-orange-500 fill-orange-500 shrink-0 sm:w-[18px] sm:h-[18px]"
          aria-hidden="true"
        />
        <span className="whitespace-nowrap">{t.streak.dayCount(entry.currentStreak)}</span>
      </div>

      <p
        className={`text-center text-[8px] sm:text-xs font-bold truncate ${
          isChampion ? 'text-amber-300' : 'text-orange-500 dark:text-orange-400'
        }`}
      >
        {flameTier(t, entry.currentStreak)}
      </p>
    </Tag>
  );
};

// The Duo Streak Hall of Fame (Sprint — Streak Together). Reached from
// MyStreaksPage's "🔥 Leaderboard" link. Every field shown is real: names,
// avatars, currentStreak/longestStreak from StreakPair, and totalXp (both
// members' real totalPoints summed) — no per-pair custom tagline, no
// invented achievement copy. No "cheer" button and no quiz-join affordance
// — explicitly out of scope for this pass.
const StreakLeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const load = () => {
    setLoadState('loading');
    getStreakLeaderboard()
      .then((result) => {
        setEntries(result);
        setLoadState('ready');
      })
      .catch((err) => {
        setError(handleAuthError(err, navigate) || t.streak.loadError);
        setLoadState('error');
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const goToPair = (pairId: string) => navigate(`/streaks/${pairId}`);

  return (
    <StudentLayout>
      <BackButton to="/streaks" label={t.streak.backToList} className="mt-1 mb-6" />

      <div className="mb-8">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          {t.streak.leaderboardTitle}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.streak.leaderboardSubtitle}</p>
      </div>

      {loadState === 'loading' && (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {loadState === 'error' && <ErrorState message={error ?? t.streak.loadError} onRetry={load} />}

      {loadState === 'ready' && entries.length === 0 && (
        <EmptyState icon={<Flame size={32} />} message={t.streak.leaderboardEmpty} />
      )}

      {loadState === 'ready' && entries.length > 0 && (
        // Extra bottom clearance (on top of StudentLayout's own pb-24) —
        // this page's list can run long, and the last row must not end up
        // stuck under the floating assistant launcher buttons that sit
        // fixed at the bottom-right of every phone screen.
        <div className="space-y-8 pb-20 lg:pb-0">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 md:gap-5 items-end">
            {top3[1] && (
              <div className="order-2 md:order-1">
                <PodiumCard
                  entry={top3[1]}
                  t={t}
                  onClick={top3[1].isCurrentUserPair ? () => goToPair(top3[1].pairId) : undefined}
                />
              </div>
            )}
            {top3[0] && (
              <div className="order-1 md:order-2">
                <PodiumCard
                  entry={top3[0]}
                  t={t}
                  onClick={top3[0].isCurrentUserPair ? () => goToPair(top3[0].pairId) : undefined}
                />
              </div>
            )}
            {top3[2] && (
              <div className="order-3">
                <PodiumCard
                  entry={top3[2]}
                  t={t}
                  onClick={top3[2].isCurrentUserPair ? () => goToPair(top3[2].pairId) : undefined}
                />
              </div>
            )}
          </div>

          {rest.length > 0 && (
            <div className="space-y-3">
              {rest.map((entry) => {
                // Same rule as the podium above: a stranger's pair detail
                // 403s server-side, so only the viewer's own row gets a real
                // handler and interactive semantics — everyone else's row is
                // a plain, non-clickable card.
                const RowTag = entry.isCurrentUserPair ? 'button' : 'div';
                return (
                <RowTag
                  key={entry.pairId}
                  type={entry.isCurrentUserPair ? 'button' : undefined}
                  onClick={entry.isCurrentUserPair ? () => goToPair(entry.pairId) : undefined}
                  className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                    entry.isCurrentUserPair
                      ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 hover:shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center font-black text-base text-slate-400 dark:text-slate-500 shrink-0">
                      {entry.rank}
                    </span>
                    <div className="relative flex items-center -space-x-2.5 shrink-0">
                      <div className="ring-2 ring-white dark:ring-slate-900 rounded-full">
                        <CommunityAvatar name={entry.userA.name} avatarUrl={entry.userA.avatarUrl} size={40} />
                      </div>
                      <div className="ring-2 ring-white dark:ring-slate-900 rounded-full">
                        <CommunityAvatar name={entry.userB.name} avatarUrl={entry.userB.avatarUrl} size={40} />
                      </div>
                      {/* Decorative flame badge — same 🔥 for every pair, tied
                          to nothing per-pair. Not the mockup's per-pair motto
                          text ("Bước Cùng Nhau" + a plant icon): that has no
                          honest data source, same reasoning that already led
                          to omitting motto/relationshipTag on the podium
                          cards above. */}
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] leading-none"
                        aria-hidden="true"
                      >
                        🔥
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {entry.userA.name} & {entry.userB.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                        <span className="text-orange-500 font-bold">{flameTier(t, entry.currentStreak)}</span>
                        {entry.isCurrentUserPair && ` · ${t.streak.leaderboardYourPair}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-sm font-black text-orange-500">
                      <Flame size={14} className="fill-orange-500" aria-hidden="true" />
                      <span>{t.streak.dayCount(entry.currentStreak)}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-bold">{entry.totalXp} XP</span>
                  </div>
                </RowTag>
                );
              })}
            </div>
          )}
        </div>
      )}
    </StudentLayout>
  );
};

export default StreakLeaderboardPage;
