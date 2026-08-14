import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Volume2, Loader2, AlertCircle } from 'lucide-react';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';
import { ApiError } from '../../../services/apiError';
import { lookupWord, DictionaryLookupResult } from '../../../services/dictionaryService';
import type { TranslationDict } from '../../../i18n/translations';

const DEBOUNCE_MS = 350;
// Mirrors LookupWordQueryDto's backend regex exactly — client-side
// validation is a UX nicety (fail fast, no round trip for an obviously bad
// query), never the source of truth; the server re-validates independently.
const QUERY_PATTERN = /^[A-Za-z'-]+(?: [A-Za-z'-]+){0,2}$/;
const MAX_QUERY_LENGTH = 64;

type PanelState =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'result'; data: DictionaryLookupResult };

// Dictionary MVP — compact lookup surface. Popover on desktop, bottom sheet
// on mobile, both anchored to the same bottom-right corner AssistantLauncher
// occupies. Never fabricates a definition: every non-"result" state is an
// honest empty/loading/error/not-found surface, never a guess.
const DictionaryPanel: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<PanelState>({ status: 'empty' });
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestTicket = useRef(0);

  // Focus goes into the surface on open, same expectation as any other
  // newly-opened panel in this app.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Outside-click + Escape, same idiom as AvatarMenu — deliberately excludes
  // BOTH this panel and the launcher button, so a click on the launcher
  // while open is handled once by its own onClick toggle rather than raced
  // by this handler closing it a tick earlier.
  useEffect(() => {
    if (!assistant) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (assistant.launcherRef.current?.contains(target)) return;
      assistant.closeTool();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      assistant.closeTool();
      assistant.launcherRef.current?.focus();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [assistant]);

  // Debounce + "latest request wins". apiFetch's own timeout wrapper always
  // builds its OWN AbortController and ignores a caller-supplied one (see
  // dictionaryService.ts's header comment), so a superseded lookup is
  // discarded by ticket rather than actually cancelled over the wire.
  useEffect(() => {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) {
      setState({ status: 'empty' });
      return;
    }
    if (trimmed.length > MAX_QUERY_LENGTH || !QUERY_PATTERN.test(trimmed)) {
      setState({ status: 'invalid' });
      return;
    }

    const ticket = (requestTicket.current += 1);
    const timer = window.setTimeout(() => {
      setState({ status: 'loading' });
      lookupWord(trimmed)
        .then((data) => {
          if (requestTicket.current !== ticket) return;
          setState({ status: 'result', data });
        })
        .catch((error: unknown) => {
          if (requestTicket.current !== ticket) return;
          if (error instanceof ApiError && error.status === 404) {
            setState({ status: 'notFound' });
            return;
          }
          if (error instanceof ApiError && error.status === 429) {
            setState({ status: 'error', message: t.dictionary.rateLimited });
            return;
          }
          setState({ status: 'error', message: t.dictionary.errorGeneric });
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, t]);

  if (!assistant) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={t.dictionary.title}
      className="fixed z-50 inset-x-0 bottom-0 lg:inset-x-auto lg:bottom-24 lg:right-8 w-full lg:w-[380px] max-h-[75vh] lg:max-h-[70vh] rounded-t-3xl lg:rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.dictionary.title}</h2>
        <button
          type="button"
          onClick={() => {
            assistant.closeTool();
            assistant.launcherRef.current?.focus();
          }}
          aria-label={t.common.close}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-4 pb-3 shrink-0">
        <label className="relative block">
          <span className="sr-only">{t.dictionary.searchLabel}</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.dictionary.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <DictionaryPanelBody state={state} t={t} />
      </div>
    </div>
  );
};

const DictionaryPanelBody: React.FC<{ state: PanelState; t: TranslationDict }> = ({
  state,
  t,
}) => {
  switch (state.status) {
    case 'empty':
      return <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">{t.dictionary.emptyState}</p>;
    case 'invalid':
      return (
        <p className="text-sm text-amber-600 dark:text-amber-400 py-6 text-center">
          {t.dictionary.invalidQuery}
        </p>
      );
    case 'loading':
      return (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {t.dictionary.loading}
        </div>
      );
    case 'notFound':
      return <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">{t.dictionary.notFound}</p>;
    case 'error':
      return (
        <div className="flex items-start gap-2 py-6 text-sm text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      );
    case 'result':
      return <DictionaryResultView data={state.data} t={t} />;
    default:
      return null;
  }
};

const playAudio = (url: string) => {
  const audio = new Audio(url);
  void audio.play().catch(() => undefined);
};

const DictionaryResultView: React.FC<{ data: DictionaryLookupResult; t: TranslationDict }> = ({
  data,
  t,
}) => {
  // A lookup that came from a real Wiktionary source, not the curated
  // VocabWord bank — that's exactly when a Wiktionary/FreeDictionaryAPI.com
  // attribution line is required. See free-dictionary-api.provider.ts's
  // header comment on the backend for the license this satisfies.
  const showAttribution = data.source !== 'VOCAB_WORD';

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-extrabold text-slate-900 dark:text-white">{data.word}</p>
          {data.ipa && <p className="text-sm text-slate-500 dark:text-slate-400">{data.ipa}</p>}
        </div>
        {data.audioUrl && (
          <button
            type="button"
            onClick={() => playAudio(data.audioUrl as string)}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={t.dictionary.searchLabel}
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>

      {data.viTranslation && (
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          {data.viTranslation}
        </p>
      )}

      <div className="space-y-2.5">
        {data.meanings.map((meaning, index) => (
          <div key={index} className="text-sm">
            {meaning.partOfSpeech && (
              <span className="inline-block px-1.5 py-0.5 mr-1.5 rounded text-[11px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {meaning.partOfSpeech}
              </span>
            )}
            {meaning.definitionEn && (
              <span className="text-slate-700 dark:text-slate-200">{meaning.definitionEn}</span>
            )}
            {meaning.exampleEn && (
              <p className="mt-0.5 text-slate-500 dark:text-slate-400 italic">“{meaning.exampleEn}”</p>
            )}
          </div>
        ))}
      </div>

      {data.synonyms.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            {t.dictionary.synonyms}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.synonyms.map((synonym) => (
              <span
                key={synonym}
                className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                {synonym}
              </span>
            ))}
          </div>
        </div>
      )}

      {showAttribution && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
          {data.sourceUrl ? (
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-slate-600 dark:hover:text-slate-300"
            >
              {t.dictionary.attribution}
            </a>
          ) : (
            t.dictionary.attribution
          )}
        </p>
      )}
    </div>
  );
};

export default DictionaryPanel;
