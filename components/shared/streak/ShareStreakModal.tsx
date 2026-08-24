import React, { useEffect, useState } from 'react';
import { Check, Copy, Facebook, Loader2, Share2 } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { generateStreakShareLink } from '../../../services/streakService';
import Modal from '../Modal';

interface ShareStreakModalProps {
  streakId: string;
  partnerName: string;
  currentStreak: number;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

// New ground for this app — no existing share/Web-Share-API/clipboard
// feature exists anywhere to copy from (confirmed during the architecture
// audit). Generic Web Share API + copy link + a Facebook sharer link
// (the one platform with a stable, documented unauthenticated share URL)
// is deliberately all that's built — see the approved plan's "do not
// implement platform-specific integrations unnecessarily" call. On mobile,
// the native share sheet (Web Share API) already offers Messenger/Zalo/etc.
// as OS-level targets; hand-rolling their own deep-link schemes isn't
// needed on top of that, and getting one wrong would be worse than
// omitting it.
const ShareStreakModal: React.FC<ShareStreakModalProps> = ({ streakId, partnerName, currentStreak, onClose }) => {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateStreakShareLink(streakId)
      .then(({ shareId }) => {
        setShareUrl(`${window.location.origin}/streak/${shareId}`);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [streakId]);

  const caption = t.streak.shareCaption(partnerName, currentStreak);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable — the link is still
      // visible and selectable in the input below, so the student can
      // copy it manually.
    }
  };

  const handleNativeShare = () => {
    void navigator.share({ title: t.streak.shareTitle, text: caption, url: shareUrl });
  };

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
          <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10 border border-orange-100 dark:border-orange-500/20 p-4">
            <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200">{caption}</p>
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
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-orange-500 text-white font-bold px-3 py-2 text-xs hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t.streak.copied : t.streak.copyLink}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold py-2.5 text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20"
            >
              <Facebook size={14} />
              Facebook
            </a>
            {typeof navigator.share === 'function' && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-2.5 text-xs hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Share2 size={14} />
                {t.streak.moreOptions}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ShareStreakModal;
