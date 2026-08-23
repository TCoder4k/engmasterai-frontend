import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';
import ChatToolTabBar, { ChatSubTab } from './ChatToolTabBar';
import EngyChatView from './EngyChatView';
import CommunityChatPanel from './community-chat/CommunityChatPanel';

// The shell shared by both chat surfaces (Community Chat sprint). Owns only
// the dialog chrome — panelRef/focus-trap/outside-click/Escape/close button
// — and which sub-tab is active; EngyChatView and CommunityChatPanel each
// own their own domain state entirely (no shared service/API/data layer
// between Engy AI and Community Chat, only this outer container).
//
// BOTH sub-views mount together, for the lifetime of the panel being open,
// and are toggled via the native `hidden` attribute rather than unmounting
// — see the comment just above the two wrapper divs below for exactly why.
// This preserves in-progress state across a tab switch (an Engy draft,
// Community's scroll position and live WebSocket connection), and keeps
// exactly one dialog/textbox match resolvable no matter which tab shows.
const ChatPanel: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<ChatSubTab>('engy');
  const panelRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape, same idiom as DictionaryPanel — excludes BOTH
  // this panel and its OWN trigger (assistant.launcherRefs.chat), not the
  // Dictionary trigger, so a click on that one behaves like any other
  // "outside" click (closes chat, then opens Dictionary — see
  // AssistantLauncher.tsx / useAssistant.ts's AssistantLauncherRefs).
  useEffect(() => {
    if (!assistant) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (assistant.launcherRefs.chat.current?.contains(target)) return;
      assistant.closeTool();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      assistant.closeTool();
      assistant.launcherRefs.chat.current?.focus();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [assistant]);

  // A light focus trap — Tab/Shift+Tab wrap within the panel rather than
  // escaping to the page behind it. Unlike DictionaryPanel (no trap): this
  // surface has a real text composer a student types into at length, so
  // accidentally tabbing out mid-conversation is a worse experience here.
  const handleTrapKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, textarea, [href], input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!assistant) return null;

  const dialogLabel = activeSubTab === 'engy' ? t.chat.title : t.communityChat.title;

  return (
    <>
      {/*
        Dimmed backdrop behind the panel. Before this, the panel (and
        DictionaryPanel, same pattern) floated directly over the page with
        nothing behind it — its own height cap (h-[min(680px,calc(100dvh-3rem))])
        only ever guarantees 24px of top clearance, so on a viewport shorter
        than ~728px the panel's top edge reaches into the page header
        instead of stopping above it. Dimming everything behind turns that
        into standard modal framing (an intentional floating card over a
        dimmed page) instead of looking like a layout glitch — same backdrop
        convention Modal.tsx already uses elsewhere. Purely decorative: no
        onClick needed, the outside-click handler above already closes the
        panel on any mousedown outside panelRef/the launcher, and this
        backdrop is outside panelRef too, so clicking it already closes via
        that existing document listener.
      */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        onKeyDown={handleTrapKeyDown}
        className="fixed z-50 inset-x-0 bottom-0 lg:inset-x-auto lg:bottom-6 lg:right-6 w-full lg:w-[420px] h-[85vh] lg:h-[min(680px,calc(100dvh-3rem))] rounded-t-3xl lg:rounded-3xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1 shrink-0 border-b border-slate-100 dark:border-slate-800">
          <ChatToolTabBar activeTab={activeSubTab} onChange={setActiveSubTab} />
          <button
            type="button"
            onClick={() => {
              assistant.closeTool();
              assistant.launcherRefs.chat.current?.focus();
            }}
            aria-label={t.common.close}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X size={18} />
          </button>
        </div>

        {/*
          Both sub-views stay mounted for the panel's lifetime; only the
          native `hidden` attribute toggles which one renders. Two things
          make this specific combination necessary rather than a Tailwind
          `hidden` utility class:
          - This app loads Tailwind from a CDN script that JIT-compiles
            classes at runtime in a real browser. Under Vitest/jsdom there is
            no such runtime, so a `className="hidden"` utility is never
            actually turned into `display:none` — Testing Library's
            getComputedStyle-based check sees nothing and every query
            matches both tabs' content at once. The native `hidden`
            attribute has no such gap: Testing Library checks the DOM
            `.hidden` IDL property directly, which jsdom implements natively
            with zero CSS involved.
          - The wrapper's className is `contents` ONLY while visible, never
            combined with `hidden` on the same element — an author-origin
            display rule (`.contents`/`.flex`/etc.) sitting on a `hidden`
            element would outrank the browser's own (non-`!important`)
            `[hidden]{display:none}` rule and defeat the hide in a real
            browser, even though jsdom's test would still pass either way.
            `display:contents` makes the wrapper itself boxless when shown,
            so each view's own top-level elements (header/list/composer)
            become direct flex items of the dialog below exactly as they
            were before this tab split.
        */}
        <div hidden={activeSubTab !== 'engy'} className={activeSubTab === 'engy' ? 'contents' : undefined}>
          <EngyChatView />
        </div>
        <div
          hidden={activeSubTab !== 'community'}
          className={activeSubTab === 'community' ? 'contents' : undefined}
        >
          <CommunityChatPanel active={activeSubTab === 'community'} />
        </div>
      </div>
    </>
  );
};

export default ChatPanel;
