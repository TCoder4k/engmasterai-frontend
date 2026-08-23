import React, { useRef } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from '../../../../i18n/useTranslation';

interface CommunityComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  maxLength: number;
}

// Small, intentionally duplicated rather than sharing a primitive with
// EngyChatView's own composer: that one is wired to Engy-specific concerns
// (quick actions, hand-off prefill, its own 2000-char max) — extracting a
// shared component now would mean threading props through an abstraction
// with exactly one real behavioural difference (max length), and risks a
// future Engy-only tweak silently regressing Community or vice versa. A
// ~15-line duplicated keyboard-event guard is cheap and keeps each panel's
// tested internals independent.
const CommunityComposer: React.FC<CommunityComposerProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  maxLength,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Same guard as EngyChatView.handleComposerKeyDown: plain Enter sends,
  // Shift+Enter falls through to the textarea's native newline, and a
  // composition-confirming Enter (typing via an IME) never sends.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSend();
  };

  return (
    <div
      className="px-3 pb-2.5 pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0"
      style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-end gap-2">
        <label className="flex-1 block">
          <span className="sr-only">{t.communityChat.composerLabel}</span>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
            onKeyDown={handleKeyDown}
            placeholder={t.communityChat.composerPlaceholder}
            rows={1}
            disabled={disabled}
            className="w-full max-h-32 resize-none px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          aria-label={t.communityChat.send}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:hover:bg-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default CommunityComposer;
