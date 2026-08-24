import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../EmptyState';
import ErrorState from '../ErrorState';
import Skeleton from '../Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { handleAuthError } from '../../../services/apiError';
import {
  acceptStreakInvitation,
  declineStreakInvitation,
  listMyStreaks,
  listStreakInvitations,
  type StreakInvitation,
  type StreakPair,
} from '../../../services/streakService';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';

type LoadState = 'loading' | 'ready' | 'error';

// The "My Streaks" list (Sprint — Streak Together, §F) — needed because
// multiple concurrent streaks per user are allowed, so a single chip isn't
// enough to see everything at once. Reached from the sidebar's new
// "🔥 Chuỗi cùng nhau" entry.
const MyStreaksPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [streaks, setStreaks] = useState<StreakPair[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<StreakInvitation[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);

  const load = () => {
    setLoadState('loading');
    Promise.all([listMyStreaks(), listStreakInvitations('received', 'PENDING')])
      .then(([streakList, invitations]) => {
        setStreaks(streakList);
        setPendingInvitations(invitations);
        setLoadState('ready');
      })
      .catch((err) => {
        setError(handleAuthError(err, navigate) || t.streak.loadError);
        setLoadState('error');
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const handleAccept = async (invitation: StreakInvitation) => {
    setBusyInvitationId(invitation.id);
    try {
      const streak = await acceptStreakInvitation(invitation.id);
      navigate(`/streaks/${streak.id}`);
    } catch {
      load();
    } finally {
      setBusyInvitationId(null);
    }
  };

  const handleDecline = async (invitation: StreakInvitation) => {
    setBusyInvitationId(invitation.id);
    try {
      await declineStreakInvitation(invitation.id);
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
    } finally {
      setBusyInvitationId(null);
    }
  };

  return (
    <StudentLayout>
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <Flame size={22} className="text-orange-500" aria-hidden="true" />
        {t.streak.myStreaksTitle}
      </h1>

      {loadState === 'loading' && (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {loadState === 'error' && <ErrorState message={error ?? t.streak.loadError} onRetry={load} />}

      {loadState === 'ready' && (
        <div className="space-y-8">
          {pendingInvitations.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3">
                {t.streak.pendingInvitationsTitle}
              </h2>
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl shadow dark:shadow-none dark:border dark:border-slate-800 p-4"
                  >
                    <CommunityAvatar
                      name={invitation.counterpart.name}
                      avatarUrl={invitation.counterpart.avatarUrl}
                      size={40}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {t.streak.invitationFrom(invitation.counterpart.name)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyInvitationId === invitation.id}
                      onClick={() => handleDecline(invitation)}
                      className="shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-3 py-2 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60"
                    >
                      {t.streak.decline}
                    </button>
                    <button
                      type="button"
                      disabled={busyInvitationId === invitation.id}
                      onClick={() => handleAccept(invitation)}
                      className="shrink-0 rounded-xl bg-orange-500 text-white font-bold px-3 py-2 text-xs hover:bg-orange-600 disabled:opacity-60"
                    >
                      {t.streak.accept}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            {streaks.length === 0 ? (
              <EmptyState icon={<Flame size={32} />} message={t.streak.noStreaksYet} />
            ) : (
              <div className="space-y-3">
                {streaks.map((streak) => (
                  <button
                    key={streak.id}
                    type="button"
                    onClick={() => navigate(`/streaks/${streak.id}`)}
                    className="w-full flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl shadow dark:shadow-none dark:border dark:border-slate-800 p-4 text-left hover:shadow-md dark:hover:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  >
                    <CommunityAvatar name={streak.partner.name} avatarUrl={streak.partner.avatarUrl} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {streak.partner.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {streak.status === 'ACTIVE' ? t.streak.activeStatus : t.streak.brokenLabel}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-extrabold">
                      <Flame size={16} className={streak.status === 'ACTIVE' ? 'fill-orange-500' : ''} aria-hidden="true" />
                      {streak.currentStreak}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </StudentLayout>
  );
};

export default MyStreaksPage;
