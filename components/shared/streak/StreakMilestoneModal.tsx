import React, { useEffect } from 'react';
import { Flame, Heart, X } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { playFlameWhoosh, playMilestone } from '../../../services/feedbackSounds';
import { fireStreakMilestoneConfetti } from '../../../services/streakCelebrationConfetti';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';

interface StreakMilestoneModalProps {
  days: number;
  meName: string;
  meAvatarUrl: string | null;
  partnerName: string;
  partnerAvatarUrl: string | null;
  onClose: () => void;
  onShare: () => void;
}

// Streak Together — the big, rare "you hit a milestone" moment (3/7/14/30/
// 50/100 days), deliberately built as its own full-bleed dark overlay
// rather than reused off Modal.tsx's light card shell — the two are meant
// to look nothing alike, since this one fires maybe a handful of times a
// month and should feel like an event, not routine chrome. Confetti +
// sound both fire once on mount; StreakDetailPage is the only caller, and
// it only ever mounts this after establishing (via localStorage) that this
// exact milestone hasn't been celebrated yet.
const StreakMilestoneModal: React.FC<StreakMilestoneModalProps> = ({
  days,
  meName,
  meAvatarUrl,
  partnerName,
  partnerAvatarUrl,
  onClose,
  onShare,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    fireStreakMilestoneConfetti();
    playFlameWhoosh();
    const timer = setTimeout(playMilestone, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.streak.milestoneModalTitle(days)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 border border-orange-500/30 shadow-[0_0_60px_-10px_rgba(249,115,22,0.5)] p-8 text-center"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <X size={18} />
        </button>

        <div className="flex items-center justify-center gap-3 mb-6">
          <CommunityAvatar name={meName} avatarUrl={meAvatarUrl} size={48} />
          <Heart size={18} className="text-rose-400 fill-rose-400" aria-hidden="true" />
          <CommunityAvatar name={partnerName} avatarUrl={partnerAvatarUrl} size={48} />
        </div>

        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <Flame size={40} className="text-white fill-white" aria-hidden="true" />
        </div>

        <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent mb-1">
          {t.streak.milestoneModalTitle(days)}
        </h2>
        <p className="text-sm font-bold text-orange-300 mb-4">{t.streak.milestoneModalSubtitle}</p>
        <p className="text-sm text-slate-300 mb-7">{t.streak.milestoneModalDescription(partnerName, days)}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-white/10 text-white font-bold py-3 text-sm hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {t.streak.milestoneModalContinue}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 text-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {t.streak.share}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StreakMilestoneModal;
