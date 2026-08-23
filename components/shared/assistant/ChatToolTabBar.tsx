import React from 'react';
import { Bot, Users } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

export type ChatSubTab = 'engy' | 'community';

interface ChatToolTabBarProps {
  activeTab: ChatSubTab;
  onChange: (tab: ChatSubTab) => void;
}

// The in-panel tab strip added for Community Chat — a horizontal strip
// inside the existing floating panel (not a wider sidebar layout), per the
// confirmed UX decision. No existing role="tab" component to reuse anywhere
// in this codebase (confirmed by a full-repo search) — this is a small, new
// primitive, deliberately minimal rather than a generic reusable component
// since nothing else needs a tab strip yet.
const ChatToolTabBar: React.FC<ChatToolTabBarProps> = ({ activeTab, onChange }) => {
  const { t } = useTranslation();
  const tabs: { id: ChatSubTab; label: string; Icon: typeof Bot }[] = [
    { id: 'engy', label: t.assistant.engyTabLabel, Icon: Bot },
    { id: 'community', label: t.assistant.communityTabLabel, Icon: Users },
  ];

  return (
    <div role="tablist" aria-label={t.assistant.chatToolTabListLabel} className="flex items-center gap-1 min-w-0">
      {tabs.map(({ id, label, Icon }) => {
        const selected = activeTab === id;
        // Community's own accent (violet) vs. Engy's existing blue — the
        // rest of the app already establishes violet as the gamification/
        // community-adjacent accent (Speaking Partner's mic glow, the
        // first-stage achievement badge), reused here rather than inventing
        // a new token (this codebase has no design-token file to pull from).
        const selectedClass = id === 'community' ? 'bg-violet-600 text-white' : 'bg-blue-600 text-white';
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              selected
                ? selectedClass
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default ChatToolTabBar;
