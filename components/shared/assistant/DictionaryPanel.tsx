import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Volume2, Loader2, AlertCircle } from 'lucide-react';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';
import { ApiError } from '../../../services/apiError';
import {
  lookupWord,
  suggestWords,
  DictionaryLookupResult,
  DictionarySuggestion,
} from '../../../services/dictionaryService';
import type { TranslationDict } from '../../../i18n/translations';

const SUGGEST_DEBOUNCE_MS = 250;
const MIN_SUGGEST_LENGTH = 2;
const SUGGESTION_LIMIT = 6;
const MAX_QUERY_LENGTH = 64;
// Mirrors LookupWordQueryDto's backend regex exactly — gates the actual
// GET /dictionary/lookup call at submit/select time. Never used reactively
// while typing: a still-incomplete prefix like "give " would fail this
// (each token needs 1+ chars), which is expected mid-word, not an error.
const QUERY_PATTERN = /^[A-Za-z'-]+(?: [A-Za-z'-]+){0,2}$/;
// Character-class only, used reactively while typing — only a genuinely
// disallowed character (digit, symbol) flashes "invalid format"; an
// in-progress prefix never does.
const INVALID_CHAR_PATTERN = /[^A-Za-z' -]/;

type PanelState =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'result'; data: DictionaryLookupResult };

type SuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'list'; items: DictionarySuggestion[] };

// Dictionary MVP — compact lookup surface. Popover on desktop, bottom sheet
// on mobile, both anchored to the same bottom-right corner AssistantLauncher
// occupies. Never fabricates a definition: every non-"result" state is an
// honest empty/loading/error/not-found surface, never a guess.
//
// Two independent surfaces share this panel: a VocabWord-only autocomplete
// (fires on every debounced keystroke, cheap, local-only) and the exact
// 3-tier lookup (fires ONLY on Enter/submit or picking a suggestion, never
// automatically while typing — see runExactLookup).
const DictionaryPanel: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [resultState, setResultState] = useState<PanelState>({ status: 'empty' });
  const [suggestState, setSuggestState] = useState<SuggestState>({ status: 'idle' });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestTicket = useRef(0);
  const suggestTicket = useRef(0);
  const suggestDebounceRef = useRef<number | null>(null);

  // Focus goes into the surface on open, same expectation as any other
  // newly-opened panel in this app.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (suggestDebounceRef.current !== null) window.clearTimeout(suggestDebounceRef.current);
    };
  }, []);

  // Outside-click + Escape, same idiom as AvatarMenu — deliberately excludes
  // BOTH this panel and the launcher button, so a click on the launcher
  // while open is handled once by its own onClick toggle rather than raced
  // by this handler closing it a tick earlier.
  //
  // Escape here only runs when the suggestion dropdown is ALREADY closed:
  // the input's own onKeyDown (below) stops propagation and closes the
  // dropdown first on the first Escape, so this document-level handler only
  // ever sees a second, later Escape.
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

  // Exact lookup — runs ONLY here, never from a typing effect. Always clears
  // the suggestion surface first (synchronously, before any network call) so
  // the old list can never linger under, or flash back over, the result.
  const runExactLookup = (rawWord: string) => {
    if (suggestDebounceRef.current !== null) {
      window.clearTimeout(suggestDebounceRef.current);
      suggestDebounceRef.current = null;
    }
    suggestTicket.current += 1; // discard any suggestion fetch already in flight
    setShowSuggestions(false);
    setSuggestState({ status: 'idle' });
    setHighlightedIndex(-1);

    const trimmed = rawWord.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) {
      setResultState({ status: 'empty' });
      return;
    }
    if (trimmed.length > MAX_QUERY_LENGTH || !QUERY_PATTERN.test(trimmed)) {
      setResultState({ status: 'invalid' });
      return;
    }

    const ticket = (requestTicket.current += 1);
    setResultState({ status: 'loading' });
    lookupWord(trimmed)
      .then((data) => {
        if (requestTicket.current !== ticket) return;
        setResultState({ status: 'result', data });
      })
      .catch((error: unknown) => {
        if (requestTicket.current !== ticket) return;
        if (error instanceof ApiError && error.status === 404) {
          setResultState({ status: 'notFound' });
          return;
        }
        if (error instanceof ApiError && error.status === 429) {
          setResultState({ status: 'error', message: t.dictionary.rateLimited });
          return;
        }
        setResultState({ status: 'error', message: t.dictionary.errorGeneric });
      });
  };

  const selectSuggestion = (item: DictionarySuggestion) => {
    setQuery(item.word);
    runExactLookup(item.word);
    inputRef.current?.focus();
  };

  // Suggestions — VocabWord-only autocomplete, debounced 250ms. Handled
  // directly from the change event (not a useEffect keyed on `query`) so
  // that runExactLookup/selectSuggestion setting `query` programmatically
  // never re-triggers a fetch — only actual typing does.
  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);

    if (suggestDebounceRef.current !== null) {
      window.clearTimeout(suggestDebounceRef.current);
      suggestDebounceRef.current = null;
    }

    const trimmed = value.trim().replace(/\s+/g, ' ');

    if (trimmed.length === 0) {
      setResultState({ status: 'empty' });
      setSuggestState({ status: 'idle' });
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }

    if (INVALID_CHAR_PATTERN.test(trimmed) || trimmed.length > MAX_QUERY_LENGTH) {
      setResultState({ status: 'invalid' });
      setSuggestState({ status: 'idle' });
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }

    // Too short to suggest yet, but not an invalid format either — reset any
    // stale invalid/result message immediately rather than a beat later.
    if (trimmed.length < MIN_SUGGEST_LENGTH) {
      setResultState({ status: 'empty' });
      setSuggestState({ status: 'idle' });
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }

    setShowSuggestions(true);
    setHighlightedIndex(-1);
    const ticket = (suggestTicket.current += 1);
    suggestDebounceRef.current = window.setTimeout(() => {
      setSuggestState({ status: 'loading' });
      suggestWords(trimmed, SUGGESTION_LIMIT)
        .then((items) => {
          if (suggestTicket.current !== ticket) return;
          setSuggestState(items.length > 0 ? { status: 'list', items } : { status: 'empty' });
        })
        .catch(() => {
          if (suggestTicket.current !== ticket) return;
          setSuggestState({ status: 'error' });
        });
    }, SUGGEST_DEBOUNCE_MS);
  };

  // Select the highlighted suggestion if there is one, otherwise run exact
  // lookup for whatever is currently typed. Shared by the form's onSubmit
  // AND the input's own Enter handling below — the latter is not redundant:
  // relying only on the browser's implicit "Enter submits a lone text
  // field" behaviour is fragile here, since role="combobox" + a custom
  // dropdown is exactly the shape the browser's OWN native autofill
  // suggestions compete with (see autoComplete="off" on the input).
  // Handling Enter explicitly makes submission deterministic regardless.
  const submitCurrentQuery = () => {
    if (showSuggestions && highlightedIndex >= 0 && suggestState.status === 'list') {
      selectSuggestion(suggestState.items[highlightedIndex]);
      return;
    }
    runExactLookup(query);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitCurrentQuery();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCurrentQuery();
      return;
    }
    if (event.key === 'Escape' && showSuggestions) {
      // Close the dropdown only — stop this Escape from also reaching the
      // document-level handler that closes the whole panel.
      event.stopPropagation();
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }
    if (!showSuggestions || suggestState.status !== 'list') return;
    const items = suggestState.items;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 >= items.length ? 0 : prev + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 < 0 ? items.length - 1 : prev - 1));
    }
  };

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

      <form onSubmit={handleSubmit} role="search" className="px-4 pb-3 shrink-0">
        <label className="relative block">
          <span className="sr-only">{t.dictionary.searchLabel}</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleInputKeyDown}
            placeholder={t.dictionary.searchPlaceholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="dictionary-suggestions-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              showSuggestions && highlightedIndex >= 0
                ? `dictionary-suggestion-${highlightedIndex}`
                : undefined
            }
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </form>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {showSuggestions ? (
          <DictionarySuggestionsList
            state={suggestState}
            query={query.trim().replace(/\s+/g, ' ')}
            highlightedIndex={highlightedIndex}
            onSelect={selectSuggestion}
            onExactLookup={runExactLookup}
            t={t}
          />
        ) : (
          <DictionaryPanelBody state={resultState} t={t} />
        )}
      </div>
    </div>
  );
};

const DictionarySuggestionsList: React.FC<{
  state: SuggestState;
  query: string;
  highlightedIndex: number;
  onSelect: (item: DictionarySuggestion) => void;
  onExactLookup: (word: string) => void;
  t: TranslationDict;
}> = ({ state, query, highlightedIndex, onSelect, onExactLookup, t }) => {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return (
        <div
          role="status"
          className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400"
        >
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {t.dictionary.suggestionsLoading}
        </div>
      );
    case 'empty':
      // No local VocabWord matched this prefix — that does not mean the
      // word doesn't exist. Exact lookup (Redis/external) can still resolve
      // it, so offer it as the next action rather than a dead end.
      return (
        <button
          type="button"
          onClick={() => onExactLookup(query)}
          className="w-full text-left px-2 py-2.5 rounded-lg text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <span className="font-semibold">
            {t.dictionary.searchFallbackAction.replace('{{word}}', query)}
          </span>
          <span className="block text-xs font-normal text-slate-400 dark:text-slate-500 mt-0.5">
            {t.dictionary.searchFallbackHint}
          </span>
        </button>
      );
    case 'error':
      return (
        <div className="flex items-start gap-2 py-6 text-sm text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t.dictionary.suggestionsError}</span>
        </div>
      );
    case 'list':
      return (
        <ul
          id="dictionary-suggestions-listbox"
          role="listbox"
          aria-label={t.dictionary.suggestionsLabel}
          className="divide-y divide-slate-100 dark:divide-slate-800"
        >
          {state.items.map((item, index) => (
            <li key={item.word} role="presentation">
              <button
                type="button"
                id={`dictionary-suggestion-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                onClick={() => onSelect(item)}
                className={`w-full text-left px-2 py-2.5 rounded-lg text-sm flex items-baseline justify-between gap-2 ${
                  index === highlightedIndex
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="font-semibold">{item.word}</span>
                {item.shortMeaningVi && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {item.shortMeaningVi}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
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
