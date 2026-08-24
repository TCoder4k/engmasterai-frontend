import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, Facebook, Flame, MessageCircle, MoreHorizontal, Trophy } from 'lucide-react';
import StudentLayout from '../../user/StudentLayout';
import EmptyState from '../EmptyState';
import ErrorState from '../ErrorState';
import Skeleton from '../Skeleton';
import { useTranslation } from '../../../i18n/useTranslation';
import { handleAuthError } from '../../../services/apiError';
import {
  acceptStreakInvitation,
  declineStreakInvitation,
  getMyInviteLink,
  listMyStreaks,
  listStreakInvitations,
  type StreakInvitation,
  type StreakPair,
} from '../../../services/streakService';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';
import { useLinkSharing } from './useLinkSharing';

type LoadState = 'loading' | 'ready' | 'error';

// "Tạo chuỗi cùng bạn bè" — a persistent, reusable per-user invite link
// (services/streakService.ts's getMyInviteLink), distinct from the targeted
// Community-Chat invite flow below it on this page (which needs a known
// inviteeId). Reuses useLinkSharing (the same copy/native-share-fallback
// logic ShareStreakModal already established) rather than forking it.
const CreateStreakLinkCard: React.FC = () => {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [inviteUrl, setInviteUrl] = useState('');
  const { copied, handleCopy, handleShareOrCopy } = useLinkSharing(inviteUrl);

  useEffect(() => {
    getMyInviteLink()
      .then(({ token }) => {
        setInviteUrl(`${window.location.origin}/invite/${token}`);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow dark:shadow-none dark:border dark:border-slate-800 p-5 sm:p-6">
      <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
            {t.streak.createLinkCardTitle}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.streak.createLinkCardDescription}</p>

          {loadState === 'loading' && <Skeleton className="h-11 w-full rounded-xl" aria-hidden="true" />}
          {loadState === 'error' && <p className="text-sm text-rose-500">{t.streak.createLinkCardLoadError}</p>}

          {loadState === 'ready' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-600 text-white font-bold px-4 py-2.5 text-xs sm:text-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? t.streak.copied : t.streak.inviteLinkCopy}
                </button>
              </div>

              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.streak.shareVia}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleShareOrCopy(t.streak.createLinkShareTitle, t.streak.createLinkShareCaption)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <span className="w-10 h-10 rounded-full bg-[#0068FF] text-white flex items-center justify-center font-black text-sm group-hover:brightness-110">
                    Z
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Zalo</span>
                </button>

                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex flex-col items-center gap-1 group"
                >
                  <span className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:brightness-110">
                    <Facebook size={16} fill="currentColor" />
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Facebook</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleShareOrCopy(t.streak.createLinkShareTitle, t.streak.createLinkShareCaption)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white flex items-center justify-center group-hover:brightness-110">
                    <MessageCircle size={16} />
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Messenger</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareOrCopy(t.streak.createLinkShareTitle, t.streak.createLinkShareCaption)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
                    <MoreHorizontal size={16} />
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {t.streak.moreOptions}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Decorative only — conveys "friends high-fiving over a streak"
            using this app's existing emoji vocabulary rather than a custom
            illustration asset, which doesn't exist anywhere in this repo. */}
        <div className="hidden sm:flex flex-col items-center justify-center gap-2 w-32" aria-hidden="true">
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-500/10 dark:to-rose-500/10 flex items-center justify-center">
            <span className="text-4xl">🙌</span>
            <span className="absolute -top-1 -right-1 text-2xl">🔥</span>
          </div>
          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 font-medium">
            {t.streak.createLinkCardCaption}
          </p>
        </div>
      </div>
    </div>
  );
};

// "Tham gia chuỗi cùng bạn bè" — purely informational here. The real join
// action lives entirely on /invite/:token (StreakInviteLandingPage), so
// this card never becomes interactive — it just tells a visitor who landed
// on this page directly (not via a link) what to expect.
const JoinStreakLinkCard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow dark:shadow-none dark:border dark:border-slate-800 p-5 sm:p-6">
      <h2 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
        {t.streak.joinLinkCardTitle}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.streak.joinLinkCardDescription}</p>
      <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-4 py-3">
        <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          {t.streak.joinLinkCardPlaceholder}
        </p>
      </div>
    </div>
  );
};

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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Flame size={22} className="text-orange-500" aria-hidden="true" />
            {t.streak.myStreaksTitle}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.streak.myStreaksSubtitle}</p>
        </div>
        <Link
          to="/streaks/leaderboard"
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold px-3 py-2 text-xs hover:bg-amber-100 dark:hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Trophy size={14} aria-hidden="true" />
          {t.streak.leaderboardNavLink}
        </Link>
      </div>

      <div className="space-y-5 mb-8">
        <CreateStreakLinkCard />
        <JoinStreakLinkCard />
      </div>

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
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3">{t.streak.myStreaksTitle}</h2>
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
                      <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            streak.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                          aria-hidden="true"
                        />
                        {streak.status === 'ACTIVE' ? t.streak.activeStatusShort : t.streak.brokenLabel}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-extrabold">
                        <Flame size={16} className={streak.status === 'ACTIVE' ? 'fill-orange-500' : ''} aria-hidden="true" />
                        {streak.currentStreak}
                      </div>
                      {/* Visual affordance only — the row above is already the
                          real <button>; a second nested interactive element
                          here would be invalid HTML. */}
                      <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold px-3 py-1.5">
                        {t.streak.viewDetails}
                      </span>
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
