import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { ApiError } from '../../../services/apiError';
import {
  acceptStreakInvitation,
  declineStreakInvitation,
  getStreakPairStatus,
  sendStreakInvitation,
  type PairRelationshipResult,
} from '../../../services/streakService';
import Modal from '../Modal';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';
import LevelBadge from '../assistant/community-chat/LevelBadge';

interface StreakEntryPopoverProps {
  userId: string;
  name: string;
  avatarUrl: string | null;
  level: number;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';
type View = 'profile' | 'confirm' | 'sent';

// The Community Chat entry point for Streak Together (Sprint — Streak
// Together, §F). Reuses Modal.tsx's centered backdrop rather than inventing
// an anchored popover primitive — this app has no such component to reuse,
// and a second overlay pattern for one feature is not worth adding.
//
// Deliberately does NOT render "Xem hồ sơ" / "Nhắn tin riêng" / "Chặn người
// dùng" / "Báo cáo" — those are separate, unbuilt features outside this
// feature's scope; only the streak action is wired here.
const StreakEntryPopover: React.FC<StreakEntryPopoverProps> = ({ userId, name, avatarUrl, level, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [relationship, setRelationship] = useState<PairRelationshipResult | null>(null);
  const [view, setView] = useState<View>('profile');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    setLoadState('loading');
    getStreakPairStatus(userId)
      .then((result) => {
        setRelationship(result);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(load, [userId]);

  useEffect(() => {
    if (view !== 'sent') return undefined;
    const timer = setTimeout(onClose, 1000);
    return () => clearTimeout(timer);
  }, [view, onClose]);

  const mapError = (error: unknown): string => {
    if (error instanceof ApiError && error.status === 429) return t.streak.rateLimited;
    if (error instanceof ApiError && error.status === 409) return t.streak.conflict;
    return t.streak.actionFailed;
  };

  const handleSendInvite = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await sendStreakInvitation(userId);
      setView('sent');
    } catch (error) {
      setActionError(mapError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!relationship?.invitation) return;
    setBusy(true);
    setActionError(null);
    try {
      const streak = await acceptStreakInvitation(relationship.invitation.id);
      onClose();
      navigate(`/streaks/${streak.id}`);
    } catch (error) {
      setActionError(mapError(error));
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!relationship?.invitation) return;
    setBusy(true);
    setActionError(null);
    try {
      await declineStreakInvitation(relationship.invitation.id);
      load();
    } catch (error) {
      setActionError(mapError(error));
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="flex items-center gap-3 mb-5">
      <CommunityAvatar name={name} avatarUrl={avatarUrl} size={48} />
      <div className="min-w-0">
        <p className="font-bold text-slate-900 dark:text-white truncate">@{name}</p>
        <LevelBadge level={level} />
      </div>
    </div>
  );

  const renderAction = () => {
    if (!relationship) return null;

    switch (relationship.relationship) {
      case 'active': {
        const streak = relationship.streak!;
        return (
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/streaks/${streak.id}`);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 font-bold py-3 text-sm hover:bg-orange-100 dark:hover:bg-orange-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <Flame size={16} aria-hidden="true" />
            {t.streak.chipDaysWith(streak.currentStreak, name)}
          </button>
        );
      }
      case 'broken':
        return (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t.streak.brokenLabel}</p>
            <button
              type="button"
              disabled={busy}
              onClick={handleSendInvite}
              className="w-full rounded-xl bg-orange-500 text-white font-bold py-3 text-sm hover:bg-orange-600 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              {t.streak.startNewStreak}
            </button>
          </div>
        );
      case 'pending_sent':
        return (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-3 text-sm cursor-default"
          >
            {t.streak.pendingSent}
          </button>
        );
      case 'pending_received':
        return (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleDecline}
              className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-3 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60"
            >
              {t.streak.decline}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleAccept}
              className="flex-1 rounded-xl bg-orange-500 text-white font-bold py-3 text-sm hover:bg-orange-600 disabled:opacity-60"
            >
              {t.streak.accept}
            </button>
          </div>
        );
      case 'none':
      default:
        return (
          <button
            type="button"
            onClick={() => setView('confirm')}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 text-white font-bold py-3 text-sm hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <Flame size={16} aria-hidden="true" />
            {t.streak.inviteAction}
          </button>
        );
    }
  };

  if (view === 'confirm') {
    return (
      <Modal title={t.streak.inviteConfirmTitle} onClose={onClose}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <CommunityAvatar name={t.streak.you} avatarUrl={null} size={44} />
            <Flame size={20} className="text-orange-500" aria-hidden="true" />
            <CommunityAvatar name={name} avatarUrl={avatarUrl} size={44} />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {t.streak.inviteConfirmQuestion(name)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t.streak.inviteConfirmDescription}</p>
          {actionError && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{actionError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView('profile')}
              className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-3 text-sm hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSendInvite}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-500 text-white font-bold py-3 text-sm hover:bg-orange-600 disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {t.streak.sendInvite}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (view === 'sent') {
    return (
      <Modal title={t.streak.inviteConfirmTitle} onClose={onClose}>
        <p className="text-center text-sm font-bold text-slate-900 dark:text-white py-4">
          🔥 {t.streak.inviteSent}
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={t.streak.profileTitle} onClose={onClose}>
      {header}
      {loadState === 'loading' && (
        <div className="flex justify-center py-4" aria-hidden="true">
          <Loader2 size={20} className="animate-spin text-slate-300" />
        </div>
      )}
      {loadState === 'error' && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t.streak.loadError}</p>
      )}
      {loadState === 'ready' && (
        <>
          {actionError && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3 text-center">{actionError}</p>}
          {renderAction()}
        </>
      )}
    </Modal>
  );
};

export default StreakEntryPopover;
