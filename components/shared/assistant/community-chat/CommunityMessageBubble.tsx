import React, { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import type { CommunityMessage } from '../../../../services/communityChatService';
import CommunityAvatar from './CommunityAvatar';
import LevelBadge from './LevelBadge';
import StreakEntryPopover from '../../streak/StreakEntryPopover';

interface CommunityMessageBubbleProps {
  message: CommunityMessage;
  isOwn: boolean;
}

// Best-effort relative time via Intl.RelativeTimeFormat, localized to
// whatever language the app is currently in — never throws on a malformed
// timestamp (falls back to an empty string, same defensive shape
// EngyChatView's formatBubbleTime uses). Computed at render time rather
// than on a ticking interval: any new message arriving (via the WebSocket
// broadcast) already re-renders this list, which is enough for an MVP —
// see the approved plan's "don't over-engineer" scope.
const formatRelativeTime = (iso: string, locale: string): string => {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  try {
    const diffSeconds = Math.round((then - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const absSeconds = Math.abs(diffSeconds);
    if (absSeconds < 60) return rtf.format(diffSeconds, 'second');
    const diffMinutes = Math.round(diffSeconds / 60);
    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    const diffDays = Math.round(diffHours / 24);
    return rtf.format(diffDays, 'day');
  } catch {
    return '';
  }
};

// URLs never break the layout (break-all on the link itself) and are never
// rendered as raw HTML — this splits on a URL pattern and renders only
// plain text nodes and <a> elements built directly by React, the same
// "never dangerouslySetInnerHTML, never a markdown parser" boundary
// EngyChatView's own user bubbles already rely on. A message containing
// literal `<script>`-looking text renders as inert text via React's normal
// escaping — no HTML is ever parsed.
const URL_SPLIT_PATTERN = /(https?:\/\/\S+)/g;
const isUrl = (part: string): boolean => /^https?:\/\/\S+$/.test(part);

const renderMessageContent = (text: string): React.ReactNode =>
  text.split(URL_SPLIT_PATTERN).map((part, index) =>
    isUrl(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer noopener"
        className="underline break-all text-blue-600 dark:text-blue-400 hover:no-underline"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );

const CommunityMessageBubble: React.FC<CommunityMessageBubbleProps> = ({ message, isOwn }) => {
  const { t, language } = useTranslation();
  const at = formatRelativeTime(message.createdAt, language);
  // Streak Together's Community Chat entry point — the avatar/name for
  // another user's message opens a popover offering "🔥 Giữ chuỗi cùng
  // nhau". Own messages have no avatar/name at all (see CommunityMessageBubble's
  // own-message branch below) and there is no self-invite flow, so this
  // state only ever applies to the other-message branch.
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Checked BEFORE isOwn on purpose: an admin's own announcement should
  // still read as an announcement to them too, not flip to the ordinary
  // right-aligned blue "own message" bubble just because they're the
  // logged-in viewer. A full-width card, not a bubble+avatar row — the
  // point is that this doesn't look like an ordinary chat message.
  if (message.author.isAdmin) {
    return (
      <div className="rounded-2xl border border-violet-100 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center">
            <Megaphone size={16} className="text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white">{message.author.name}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-none uppercase tracking-wide">
                {t.communityChat.adminBadge}
              </span>
              {at && <span className="text-[10px] text-slate-400 dark:text-slate-500">{at}</span>}
            </div>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
              {renderMessageContent(message.content)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isOwn) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] flex flex-col items-end">
          <div className="rounded-2xl rounded-br-sm bg-blue-600 text-white px-3.5 py-2 text-sm max-w-full">
            <span className="whitespace-pre-wrap break-words">{renderMessageContent(message.content)}</span>
          </div>
          {at && <span className="mt-1 px-1 text-[10px] text-slate-400 dark:text-slate-500">{at}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2">
      <button
        type="button"
        onClick={() => setPopoverOpen(true)}
        className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <CommunityAvatar name={message.author.name} avatarUrl={message.author.avatarUrl} size={28} />
      </button>
      <div className="max-w-[78%] min-w-0">
        <div className="flex items-center mb-0.5 min-w-0">
          <button
            type="button"
            onClick={() => setPopoverOpen(true)}
            className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate mr-2.5 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
          >
            @{message.author.name}
          </button>
          <LevelBadge level={message.author.level} />
          {at && <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{at}</span>}
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3.5 py-2 text-sm">
          <span className="whitespace-pre-wrap break-words">{renderMessageContent(message.content)}</span>
        </div>
      </div>
      {popoverOpen && (
        <StreakEntryPopover
          userId={message.author.id}
          name={message.author.name}
          avatarUrl={message.author.avatarUrl}
          level={message.author.level}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );
};

export default CommunityMessageBubble;
