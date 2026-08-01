import React from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { GamificationResult } from '../../services/gamificationService';

// Sprint 10 — the "+30 XP" announcement.
//
// MOTION IS NEVER THE ONLY CARRIER OF STATE. This toast is a garnish: the XP it
// announces has already been folded into the level widget in the sidebar, which
// is the durable place the student can look. A student with
// `prefers-reduced-motion` set, or one who simply looks away for two seconds,
// loses nothing.
//
// It is therefore also `aria-live="polite"` rather than assertive — worth
// mentioning, never worth interrupting what a screen-reader user is doing.
//
// Rendered once, by GamificationProvider, rather than by each learning stage.
// Awards arrive from five endpoints consumed by components that share no
// ancestor below the router; one renderer beside the subscription is far less
// to keep in step than five.

interface XpToastProps {
  award: GamificationResult;
  onDismiss: () => void;
}

const XpToast: React.FC<XpToastProps> = ({ award, onDismiss }) => {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 z-50 max-w-[calc(100vw-2rem)] sm:max-w-xs"
    >
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-ink-900 shadow-lg motion-safe:animate-in">
        <span
          className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {award.leveledUp ? <Trophy size={18} /> : <Sparkles size={18} />}
        </span>

        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
            +{award.xpAwarded} XP
          </p>

          {award.leveledUp && (
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {t.widgets.levelUp.replace('{level}', String(award.xp.level))}
            </p>
          )}

          {award.unlockedAchievements.map((key) => (
            <p
              key={key}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400"
            >
              🏆 {t.achievements[key]}
            </p>
          ))}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.common.close}
          className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default XpToast;
