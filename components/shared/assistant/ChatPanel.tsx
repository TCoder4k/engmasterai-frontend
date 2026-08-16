import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, AlertCircle, Plus, Headphones, Target, Lightbulb } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';
import { ApiError } from '../../../services/apiError';
import { newUuidV4 } from '../../../services/clientSessionId';
import {
  sendChatMessage,
  getChatSession,
  clearChatSession,
  ChatContextInput,
  ChatTurn,
} from '../../../services/chatService';

const MAX_MESSAGE_LENGTH = 2000; // mirrors SendChatMessageDto's backend limit
const GENERAL_CONTEXT: ChatContextInput = { type: 'GENERAL' };

// A transparent, tightly-cropped mascot badge — no baked-in text, no huge
// opaque-white canvas (the source `2.png` is a 1024x1536 white canvas with
// the badge occupying a small fraction of it; the white was flood-filled to
// transparent and the result re-cropped to the badge's own bounds — see the
// crop/removal note in the sprint doc). Same asset AssistantLauncher's Engy
// trigger uses. Reused for every small repeating avatar spot: the header,
// per-bubble, and the empty-state greeting graphic.
const MASCOT_SRC = '/mascot/engy-icon.png';

type Bubble = { id: string; role: 'user' | 'assistant'; text: string; at: number };

type PendingMessage = {
  clientMessageId: string;
  text: string;
  status: 'sending' | 'failed';
  error?: string;
  /** Reused verbatim on retry — never re-derived from the (possibly since-changed) ambient lesson context. */
  context: ChatContextInput;
};

type SessionLoad = 'loading' | 'ready' | 'error';

// Turns restore as flat (user, assistant) pairs — see chat.controller.ts's
// GET /chat/session. Historical turns have no clientMessageId to retry
// with, so their bubble ids are just positional.
const turnsToBubbles = (turns: ChatTurn[]): Bubble[] =>
  turns.map((turn, index) => ({
    id: `restored-${index}`,
    role: turn.role,
    text: turn.text,
    at: turn.at,
  }));

// Best-effort "HH:MM" formatting for a bubble timestamp. Never throws: a
// mocked/malformed value (tests routinely stub repliedAt with a placeholder
// string) falls back to "now" rather than rendering "Invalid Date".
const safeTimestamp = (value: number): number => (Number.isFinite(value) ? value : Date.now());
const formatBubbleTime = (at: number): string => {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(at);
  } catch {
    return '';
  }
};

// Markdown -> React elements only (react-markdown never touches innerHTML,
// and — critically — never renders raw HTML found in the source unless the
// rehype-raw plugin is added, which it deliberately is NOT here). Every
// element is mapped to EngMasterAI's own compact chat typography instead of
// react-markdown's default (unstyled) output. `a` relies on react-markdown's
// built-in defaultUrlTransform (unchanged — no custom urlTransform passed)
// to strip unsafe schemes such as javascript:; only http(s)/mailto/tel and
// relative URLs pass through.
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-5 space-y-0.5 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-5 space-y-0.5 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="mt-1 mb-1 font-bold text-[15px] leading-snug">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-1 mb-1 font-bold text-[15px] leading-snug">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-1 mb-1 font-bold text-sm leading-snug">{children}</h3>,
  h4: ({ children }) => <h3 className="mt-1 mb-1 font-bold text-sm leading-snug">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 pl-2.5 border-l-2 border-slate-300 dark:border-slate-600 italic text-slate-600 dark:text-slate-300">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    // Fenced code blocks come through as <pre><code className="language-…">;
    // an inline `code` span has no language class at all — this is the same
    // heuristic react-markdown's own docs recommend for telling them apart
    // without a syntax-highlighting plugin.
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return (
        <code className="font-mono text-[13px]" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="px-1 py-0.5 rounded bg-black/[0.06] dark:bg-white/10 font-mono text-[13px] break-words"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-1.5 max-w-full overflow-x-auto rounded-lg bg-slate-900 dark:bg-black/40 text-slate-100 p-2.5">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline break-words text-blue-600 dark:text-blue-400 hover:no-underline"
    >
      {children}
    </a>
  ),
};

const AssistantMarkdown: React.FC<{ text: string }> = ({ text }) => (
  <div className="max-w-full break-words">
    <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
  </div>
);

// Engy Chat MVP (Phase B) — the shell's second panel, sharing the exact
// single-slot activeTool mechanism DictionaryPanel already uses (see
// AssistantBoundary.tsx). Only ONE message may be in flight/failed at a
// time (composerDisabled below): this keeps "sending / success / failed"
// unambiguous without a queue, and is exactly what makes "retry reuses the
// same clientMessageId" simple to guarantee — there is only ever one
// pending id to reuse.
const ChatPanel: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();
  const [composerText, setComposerText] = useState('');
  const [history, setHistory] = useState<Bubble[]>([]);
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [sessionLoad, setSessionLoad] = useState<SessionLoad>('loading');
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Phase C — a ONE-SHOT override consumed by the very next send only (see
  // useAssistant.ts's ChatHandoffPayload doc comment). A ref, not state:
  // it must survive between the hand-off effect and handleSend without
  // itself triggering a render, and gets cleared the instant it's used.
  const nextSendContextOverride = useRef<ChatContextInput | null>(null);

  // Focus goes into the surface on open, same expectation as DictionaryPanel.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Phase C — consumes a pending Dictionary→Engy hand-off exactly once.
  // Pre-fills the composer and remembers the context override for the next
  // send; assistant.consumeHandoff() clears the shared flag immediately so
  // reopening the panel later (without a new hand-off) never repeats it.
  useEffect(() => {
    if (!assistant?.pendingHandoff) return;
    const { prefillMessage, context } = assistant.pendingHandoff;
    setComposerText(prefillMessage);
    nextSendContextOverride.current = context;
    assistant.consumeHandoff();
    textareaRef.current?.focus();
  }, [assistant?.pendingHandoff, assistant]);

  // GET /chat/session exactly once per open — the panel unmounts on close
  // (AssistantBoundary only renders it while activeTool === 'chat'), so
  // this empty-deps effect already can't re-fire on unrelated rerenders.
  useEffect(() => {
    let cancelled = false;
    getChatSession()
      .then((session) => {
        if (cancelled) return;
        setHistory(turnsToBubbles(session.turns));
        setSessionLoad('ready');
      })
      .catch(() => {
        if (cancelled) return;
        // A restore failure never blocks starting a fresh conversation —
        // it only means history from a prior visit couldn't be shown.
        setSessionLoad('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [history, pending]);

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

  const mapErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.status === 429) return t.chat.rateLimited;
      if (error.code === 'ASSESSMENT_IN_PROGRESS') return t.chat.assessmentInProgress;
      if (error.code === 'CHAT_REPLY_IN_PROGRESS') return t.chat.replyInProgress;
    }
    return t.chat.failedGeneric;
  };

  const submitMessage = async (
    clientMessageId: string,
    text: string,
    context: ChatContextInput,
  ) => {
    setPending({ clientMessageId, text, status: 'sending', context });
    try {
      const result = await sendChatMessage(clientMessageId, text, context);
      const repliedAt = Date.parse(result.repliedAt);
      setHistory((prev) => [
        ...prev,
        { id: clientMessageId, role: 'user', text, at: Date.now() },
        {
          id: `${clientMessageId}-assistant`,
          role: 'assistant',
          text: result.reply,
          at: Number.isFinite(repliedAt) ? repliedAt : Date.now(),
        },
      ]);
      setPending(null);
    } catch (error) {
      setPending({
        clientMessageId,
        text,
        status: 'failed',
        context,
        error: mapErrorMessage(error),
      });
    }
  };

  const handleSend = () => {
    const trimmed = composerText.trim();
    if (!trimmed || pending !== null) return;
    // A hand-off override applies to only THIS send; everything after
    // falls back to the ambient lesson context (if any) or GENERAL — see
    // useAssistant.ts's ChatHandoffPayload doc comment.
    const context =
      nextSendContextOverride.current ??
      (assistant?.lessonContext
        ? {
            type: 'LESSON' as const,
            resourceId: assistant.lessonContext.lessonId,
            stage: assistant.lessonContext.stage,
          }
        : GENERAL_CONTEXT);
    nextSendContextOverride.current = null;
    setComposerText('');
    void submitMessage(newUuidV4(), trimmed, context);
  };

  const handleRetry = () => {
    if (!pending) return;
    const { clientMessageId, text, context } = pending;
    void submitMessage(clientMessageId, text, context);
  };

  // Root cause of the original Enter/Shift+Enter report: plain Enter already
  // sent and Shift+Enter already fell through to the textarea's native
  // newline behaviour (nothing here re-implements that manually), but there
  // was no guard against IME composition — confirming a composed character
  // (e.g. typing Vietnamese/CJK via an IME) also fires a `key === 'Enter'`
  // keydown, which was being misread as "submit". `isComposing` is checked
  // on the native event so a composition-confirming Enter never sends.
  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleSend();
  };

  const handleClear = async () => {
    try {
      await clearChatSession();
    } catch {
      // Best-effort: even if the server call fails, clearing the visible
      // conversation locally is still useful and never leaves the UI stuck.
    }
    setHistory([]);
    setPending(null);
  };

  const runQuickAction = (prompt: string) => {
    if (pending !== null) return;
    setComposerText(prompt);
    textareaRef.current?.focus();
  };

  if (!assistant) return null;

  const composerDisabled = pending !== null;
  const quickActions = [
    { Icon: Headphones, label: t.chat.quickListeningLabel, sub: t.chat.quickListeningSub, prompt: t.chat.quickListeningPrompt },
    { Icon: Target, label: t.chat.quickToeicLabel, sub: t.chat.quickToeicSub, prompt: t.chat.quickToeicPrompt },
    { Icon: Lightbulb, label: t.chat.quickStudyPlanLabel, sub: t.chat.quickStudyPlanSub, prompt: t.chat.quickStudyPlanPrompt },
  ];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t.chat.title}
      onKeyDown={handleTrapKeyDown}
      className="fixed z-50 inset-x-0 bottom-0 lg:inset-x-auto lg:bottom-6 lg:right-6 w-full lg:w-[420px] h-[85vh] lg:h-[min(680px,calc(100dvh-3rem))] rounded-t-3xl lg:rounded-3xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={MASCOT_SRC}
            alt=""
            aria-hidden="true"
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {t.chat.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.chat.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void handleClear()}
            aria-label={t.chat.clearConversation}
            title={t.chat.clearConversation}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Plus size={18} />
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              assistant.closeTool();
              assistant.launcherRefs.chat.current?.focus();
            }}
            aria-label={t.common.close}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
        {sessionLoad === 'error' && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            {t.chat.sessionLoadError}
          </p>
        )}

        {sessionLoad !== 'loading' && history.length === 0 && !pending && (
          <div className="py-6 text-center">
            <img
              src={MASCOT_SRC}
              alt=""
              aria-hidden="true"
              className="w-14 h-14 rounded-full object-cover mx-auto mb-3"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.chat.greeting}</p>
          </div>
        )}

        {history.map((bubble) => (
          <ChatBubble key={bubble.id} role={bubble.role} text={bubble.text} at={bubble.at} />
        ))}

        {pending && (
          <>
            <ChatBubble
              role="user"
              text={pending.text}
              at={safeTimestamp(Date.now())}
              muted={pending.status === 'sending'}
            />
            {pending.status === 'sending' && (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                {t.chat.thinking}
              </div>
            )}
            {pending.status === 'failed' && (
              <div className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p>{pending.error}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-1 font-semibold underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                  >
                    {t.chat.retry}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pt-1 pb-2 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map(({ Icon, label, prompt }) => (
            <button
              key={label}
              type="button"
              onClick={() => runQuickAction(prompt)}
              disabled={composerDisabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Icon size={14} className="text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="px-3 pb-2.5 pt-1 border-t border-slate-100 dark:border-slate-800 shrink-0"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-2">
          <label className="flex-1 block">
            <span className="sr-only">{t.chat.composerLabel}</span>
            <textarea
              ref={textareaRef}
              value={composerText}
              onChange={(event) => setComposerText(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleComposerKeyDown}
              placeholder={t.chat.composerPlaceholder}
              rows={1}
              disabled={composerDisabled}
              className="w-full max-h-32 resize-none px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={handleSend}
            disabled={composerDisabled || composerText.trim().length === 0}
            aria-label={t.chat.send}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// User messages stay the visually prominent solid bubble. Assistant
// messages are deliberately near-surface/plain (no filled card, no border)
// so a long multi-paragraph Markdown reply reads as a chat message rather
// than a dashboard card — a small avatar + timestamp header line, content
// below, no consecutive-message grouping logic (kept simple on purpose).
const ChatBubble: React.FC<{ role: 'user' | 'assistant'; text: string; at: number; muted?: boolean }> = ({
  role,
  text,
  at,
  muted,
}) => {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] flex flex-col items-end">
          <div
            className={`rounded-2xl rounded-br-sm bg-blue-600 text-white px-3.5 py-2 text-sm max-w-full ${muted ? 'opacity-60' : ''}`}
          >
            {/* User input is never interpreted as Markdown — only Gemini's
                assistant replies are, and only through the safe renderer
                below (no dangerouslySetInnerHTML, no raw HTML). */}
            <span className="whitespace-pre-wrap break-words">{text}</span>
          </div>
          <span className="mt-1 px-1 text-[10px] text-slate-400 dark:text-slate-500">
            {formatBubbleTime(at)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] w-full">
        <div className="flex items-center gap-1.5 mb-1">
          <img
            src={MASCOT_SRC}
            alt=""
            aria-hidden="true"
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatBubbleTime(at)}</span>
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <AssistantMarkdown text={text} />
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
