import { useState } from 'react';

interface LinkSharing {
  copied: boolean;
  handleCopy: () => Promise<void>;
  handleShareOrCopy: (shareTitle: string, shareText: string) => Promise<void>;
}

// Shared by ShareStreakModal and the "Tạo chuỗi cùng bạn bè" card on
// MyStreaksPage — new ground for this app the first time ShareStreakModal
// built it (no existing share/Web-Share-API/clipboard code anywhere else to
// copy from; see that file's own header comment for the full reasoning
// behind native-share-with-clipboard-fallback over a guessed Messenger/Zalo
// deep link). Extracted here once a second caller needed the identical
// behavior, so the two can't silently drift apart.
export const useLinkSharing = (url: string): LinkSharing => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable — the link stays visible
      // and selectable wherever the caller renders it.
    }
  };

  const handleShareOrCopy = async (shareTitle: string, shareText: string): Promise<void> => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      } catch {
        // User cancelled, or the share failed — fall through to copy.
      }
    }
    await handleCopy();
  };

  return { copied, handleCopy, handleShareOrCopy };
};
