import React, { useEffect, useState } from 'react';
import { Check, Volume2, RefreshCw, Bot } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import { translateSpeakingText } from '../../../services/speakingService';

export interface ConversationTurn {
  role: 'ai' | 'user';
  text: string;
  /** Epoch ms, set client-side when the turn is appended — display only, never sent to the server. */
  at: number;
}

/**
 * Per-turn subtitle-translation state, keyed by turn index (turns are
 * append-only for the life of one session, so an index is a stable enough
 * key here — same reasoning as the list's own `key={index}`). An explicit
 * union rather than a bare `Record<index, string>` cache: a failed
 * translation must render as its own state with a retry, not silently show
 * nothing or look like a stuck spinner forever — and it must never touch
 * anything outside this component. The conversation itself has no idea
 * whether a subtitle succeeded, failed, or was never requested.
 */
type SubtitleState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; textVi: string }
  | { status: 'error' };

const formatTime = (at: number): string =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Speaking Partner — chat-bubble transcript. Timestamps, a per-message
// replay (speaker) button on AI lines, a sent checkmark on user lines, and —
// when the parent's subtitle toggle is on — an on-demand Vietnamese line
// under each AI bubble, translated once and cached for the life of the
// session. Bubbles/waveform were Phase 3 scope per this file's own earlier
// header comment; that pass is this one.
const ConversationTurnList: React.FC<{
  turns: ConversationTurn[];
  showSubtitles: boolean;
  /** Plays turn `index`'s ORIGINAL Gemini Live audio from the parent's per-turn cache — never re-synthesized, and no network/Gemini call, including for index 0 (the opening line, cued through Live the same as any other turn). */
  onPlayTurn: (index: number) => void;
}> = ({ turns, showSubtitles, onPlayTurn }) => {
  const { t } = useTranslation();
  const [subtitles, setSubtitles] = useState<Record<number, SubtitleState>>({});

  const translateTurn = (index: number, text: string) => {
    setSubtitles((prev) => ({ ...prev, [index]: { status: 'loading' } }));
    translateSpeakingText(text)
      .then((result) => {
        setSubtitles((prev) => ({ ...prev, [index]: { status: 'success', textVi: result.textVi } }));
      })
      .catch(() => {
        // A translation failure is local to this one line — the
        // conversation itself is completely unaffected, and the student can
        // keep recording and sending turns normally regardless.
        setSubtitles((prev) => ({ ...prev, [index]: { status: 'error' } }));
      });
  };

  useEffect(() => {
    if (!showSubtitles) return;
    turns.forEach((turn, index) => {
      if (turn.role !== 'ai') return;
      const current = subtitles[index];
      if (current && current.status !== 'idle') return;
      translateTurn(index, turn.text);
    });
    // Only re-run when the toggle flips on or a new turn arrives — subtitles
    // is intentionally excluded so a retry (which also writes subtitles)
    // does not re-trigger this effect for every other line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSubtitles, turns]);

  return (
    <div className="space-y-4">
      {turns.map((turn, index) => {
        const isUser = turn.role === 'user';
        const subtitle = subtitles[index];

        return (
          // eslint-disable-next-line react/no-array-index-key -- turns are append-only for the life of one session
          <div key={index} className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
              <div
                aria-hidden="true"
                className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center"
              >
                <Bot size={20} className="text-white" aria-hidden="true" />
              </div>
            )}
            <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center gap-1.5 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  {isUser ? t.practice.speakingYouLabel : t.practice.speakingAiLabel}
                </p>
                <p className="text-[11px] font-medium text-slate-300 dark:text-slate-600">
                  {formatTime(turn.at)}
                </p>
              </div>

              <div className={`inline-flex items-end gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                <p
                  className={`inline-block rounded-2xl px-4 py-2.5 text-sm font-medium ${
                    isUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {turn.text}
                </p>
                {isUser ? (
                  <Check
                    size={14}
                    className="text-slate-400 dark:text-slate-500 shrink-0 mb-1.5"
                    aria-hidden="true"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onPlayTurn(index)}
                    aria-label={t.practice.speakingPlayMessage}
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <Volume2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              {!isUser && showSubtitles && subtitle && (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {subtitle.status === 'loading' && <span>…</span>}
                  {subtitle.status === 'success' && <span>{subtitle.textVi}</span>}
                  {subtitle.status === 'error' && (
                    <span className="inline-flex items-center gap-1 text-rose-500 dark:text-rose-400">
                      {t.practice.speakingSubtitleError}
                      <button
                        type="button"
                        onClick={() => translateTurn(index, turn.text)}
                        className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2 focus:outline-none"
                      >
                        <RefreshCw size={11} aria-hidden="true" />
                        {t.practice.speakingSubtitleRetry}
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationTurnList;
