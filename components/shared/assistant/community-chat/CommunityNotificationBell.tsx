import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useAssistant } from '../useAssistant';

// Community Chat's notification-mute toggle — rendered by ChatPanel.tsx in
// its shared header, only while the Community tab is active. Own
// open/close state with outside-click + Escape, same idiom as
// AvatarMenu.tsx/DictionaryPanel.tsx (not shared code — this menu is a
// small two-option radio group, not a full nav menu). The actual mute
// state lives on AssistantContext (see useAssistant.ts's
// communityNotificationsMuted doc comment) — this component is purely the
// UI for reading/toggling it.
const CommunityNotificationBell: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!assistant) return null;
  const muted = assistant.communityNotificationsMuted;

  const choose = (nextMuted: boolean) => {
    assistant.setCommunityNotificationsMuted(nextMuted);
    setIsOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={muted ? t.communityChat.notificationsBellLabelOff : t.communityChat.notificationsBellLabelOn}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        {muted ? <BellOff size={16} /> : <Bell size={16} />}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t.communityChat.notificationsBellLabelOn}
          className="absolute right-0 top-10 z-10 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-ink-900 shadow-lg py-1.5"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!muted}
            onClick={() => choose(false)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">
              <Bell size={14} aria-hidden="true" />
              {t.communityChat.notificationsAllOption}
            </span>
            {!muted && <Check size={14} className="text-violet-600 dark:text-violet-400" aria-hidden="true" />}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={muted}
            onClick={() => choose(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">
              <BellOff size={14} aria-hidden="true" />
              {t.communityChat.notificationsOffOption}
            </span>
            {muted && <Check size={14} className="text-violet-600 dark:text-violet-400" aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default CommunityNotificationBell;
