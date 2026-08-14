import React from 'react';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';

// Phase A — the one floating trigger for the assistant shell. Opens the
// Dictionary panel directly, the only tool that exists yet; Phase B adds
// Engy chat behind the same `activeTool` slot without changing this file's
// shape (see useAssistant.ts's AssistantTool union, already 'dictionary' |
// 'chat').
//
// Positioned ABOVE XpToast deliberately (bottom-40/bottom-24 vs XpToast's
// bottom-24/bottom-8) — both are right-anchored bottom-corner controls, and
// stacking is simpler and safer than fighting over the same spot.
const AssistantLauncher: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();

  // Outside the boundary (admin routes, tests) — render nothing rather than
  // crash, matching useGamification's degrade-gracefully convention.
  if (!assistant) return null;

  const isOpen = assistant.activeTool === 'dictionary';

  return (
    <button
      ref={assistant.launcherRef}
      type="button"
      onClick={() => assistant.toggleTool('dictionary')}
      aria-label={t.assistant.openLauncher}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className="fixed bottom-40 lg:bottom-24 right-4 lg:right-8 z-40 w-14 h-14 rounded-full overflow-hidden bg-white dark:bg-ink-900 shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
    >
      <img
        src="/mascot/happy.png"
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover select-none pointer-events-none"
      />
    </button>
  );
};

export default AssistantLauncher;
