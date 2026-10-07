import React from 'react';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';
import { authService } from '../../../services/authService';
import { Users } from 'lucide-react';

const AssistantLauncher: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();
  const user = authService.getUser();
  const isAdmin = user?.role === 'ADMIN';

  // Outside the boundary (admin routes, tests) — render nothing rather than
  // crash, matching useGamification's degrade-gracefully convention.
  if (!assistant) return null;

  if (isAdmin) {
    return (
      <div className="fixed z-40 right-3 sm:right-4 lg:right-7 bottom-20 lg:bottom-6 flex flex-col items-center gap-2.5">
        <button
          ref={assistant.launcherRefs.chat}
          type="button"
          onClick={() => assistant.toggleTool('chat')}
          aria-label="Hỗ trợ học viên / Tán gẫu"
          aria-haspopup="dialog"
          aria-expanded={assistant.activeTool === 'chat'}
          className="relative w-[52px] h-[52px] bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
          title="Hỗ trợ học viên / Tán gẫu"
        >
          <Users size={24} aria-hidden="true" />
          {assistant.communityUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
              {assistant.communityUnreadCount > 9 ? '9+' : assistant.communityUnreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed z-40 right-3 sm:right-4 lg:right-7 bottom-20 lg:bottom-6 flex flex-col items-center gap-2.5">
      <button
        ref={assistant.launcherRefs.dictionary}
        type="button"
        onClick={() => assistant.toggleTool('dictionary')}
        aria-label={t.assistant.openDictionary}
        aria-haspopup="dialog"
        aria-expanded={assistant.activeTool === 'dictionary'}
        className="w-[46px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded-lg"
      >
        <img
          src="/mascot/dictionary-icon.png"
          alt=""
          aria-hidden="true"
          className="w-full h-auto object-contain select-none pointer-events-none"
        />
      </button>
      <button
        ref={assistant.launcherRefs.chat}
        type="button"
        onClick={() => assistant.toggleTool('chat')}
        aria-label={t.assistant.openLauncher}
        aria-haspopup="dialog"
        aria-expanded={assistant.activeTool === 'chat'}
        className="relative w-[58px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded-full"
      >
        <img
          src="/mascot/engy-icon.png"
          alt=""
          aria-hidden="true"
          className="w-full h-auto object-contain select-none pointer-events-none"
        />
        {/* Community Chat unread badge — same styling precedent as
            NotificationBell.tsx's badge, the one other unread indicator in
            this app. Represents Tán gẫu's unread count specifically (Engy AI
            is a synchronous 1:1 AI chat with no "unread from someone else"
            concept), but sits on the shared launcher since it's the one
            button that opens both. */}
        {assistant.communityUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
            {assistant.communityUnreadCount > 9 ? '9+' : assistant.communityUnreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default AssistantLauncher;
