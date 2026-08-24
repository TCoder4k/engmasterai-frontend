import React, { useEffect, useState } from 'react';
import { Check, Copy, Facebook, Link2, Loader2, MessageCircle, MoreHorizontal } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { generateStreakShareLink } from '../../../services/streakService';
import Modal from '../Modal';
import CommunityAvatar from '../assistant/community-chat/CommunityAvatar';
import { useLinkSharing } from './useLinkSharing';

interface ShareStreakModalProps {
  streakId: string;
  partnerName: string;
  partnerAvatarUrl: string | null;
  currentStreak: number;
  meName: string;
  meAvatarUrl: string | null;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

// New ground for this app — no existing share/Web-Share-API/clipboard
// feature exists anywhere to copy from (confirmed during the architecture
// audit). Facebook links directly via sharer.php (real, documented,
// app-id-free). Messenger and Zalo have NO equivalent: Messenger's
// documented share scheme requires a registered Facebook App ID this
// project doesn't have, and Zalo's only script-free option doesn't exist —
// their real mechanism is their own SDK. Rather than guess a broken deep
// link for either (confirmed against Meta's and Zalo's own docs before
// building this), both icons — plus "More" — trigger the device's native
// share sheet, where Messenger/Zalo are real, working targets on mobile;
// on desktop, where no native share sheet exists, they fall back to
// copying the link. This was a deliberate, confirmed product decision, not
// a shortcut.
const ShareStreakModal: React.FC<ShareStreakModalProps> = ({
  streakId,
  partnerName,
  partnerAvatarUrl,
  currentStreak,
  meName,
  meAvatarUrl,
  onClose,
}) => {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [shareUrl, setShareUrl] = useState('');
  const { copied, handleCopy, handleShareOrCopy } = useLinkSharing(shareUrl);

  useEffect(() => {
    generateStreakShareLink(streakId)
      .then(({ shareId }) => {
        setShareUrl(`${window.location.origin}/streak/${shareId}`);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [streakId]);

  const caption = t.streak.shareCaption(partnerName, currentStreak);
  const [hook, reason, tagline] = caption.split('\n\n');
  const domain = shareUrl ? new URL(shareUrl).host : '';

  return (
    <Modal title={t.streak.shareTitle} onClose={onClose}>
      {loadState === 'loading' && (
        <div className="flex justify-center py-6" aria-hidden="true">
          <Loader2 size={20} className="animate-spin text-slate-300" />
        </div>
      )}

      {loadState === 'error' && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t.streak.shareError}</p>
      )}

      {loadState === 'ready' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white text-sm leading-snug">{hook}</p>
                {reason && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">{reason}</p>
                )}
              </div>
              <div className="relative shrink-0 w-16 h-12">
                <div className="absolute left-0 top-0 rounded-full ring-2 ring-slate-50 dark:ring-slate-800">
                  <CommunityAvatar name={meName} avatarUrl={meAvatarUrl} size={40} />
                </div>
                <div className="absolute left-6 top-0 rounded-full ring-2 ring-slate-50 dark:ring-slate-800">
                  <CommunityAvatar name={partnerName} avatarUrl={partnerAvatarUrl} size={40} />
                </div>
                <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-violet-500 text-white text-xs font-black px-2 py-0.5 shadow-md shadow-violet-500/30 whitespace-nowrap">
                  {currentStreak}
                </div>
              </div>
            </div>
            {tagline && (
              <div className="border-t border-slate-200 dark:border-slate-700 mt-3 pt-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{tagline}</p>
                {domain && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{domain}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            <button type="button" onClick={handleCopy} className="flex flex-col items-center gap-1.5 group">
              <span className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
                {copied ? <Check size={18} /> : <Link2 size={18} />}
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                {copied ? t.streak.copied : t.streak.copyLink}
              </span>
            </button>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex flex-col items-center gap-1.5 group"
            >
              <span className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:brightness-110">
                <Facebook size={18} fill="currentColor" />
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Facebook</span>
            </a>

            <button type="button" onClick={() => handleShareOrCopy(t.streak.shareTitle, caption)} className="flex flex-col items-center gap-1.5 group">
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white flex items-center justify-center group-hover:brightness-110">
                <MessageCircle size={18} />
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Messenger</span>
            </button>

            <button type="button" onClick={() => handleShareOrCopy(t.streak.shareTitle, caption)} className="flex flex-col items-center gap-1.5 group">
              <span className="w-11 h-11 rounded-full bg-[#0068FF] text-white flex items-center justify-center font-black text-sm group-hover:brightness-110">
                Z
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Zalo</span>
            </button>

            <button type="button" onClick={() => handleShareOrCopy(t.streak.shareTitle, caption)} className="flex flex-col items-center gap-1.5 group">
              <span className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
                <MoreHorizontal size={18} />
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{t.streak.moreOptions}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-violet-500 text-white font-bold px-3 py-2 text-xs hover:bg-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t.streak.copied : t.streak.copyButton}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ShareStreakModal;
