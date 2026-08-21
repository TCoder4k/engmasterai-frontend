import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Volume2, Loader2, AlertCircle, MessageCircle, Star, ChevronRight } from 'lucide-react';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';
import { ApiError } from '../../../services/apiError';
import {
  lookupWord,
  suggestWords,
  DictionaryLookupResult,
  DictionaryMeaning,
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
      if (assistant.launcherRefs.dictionary.current?.contains(target)) return;
      assistant.closeTool();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      assistant.closeTool();
      assistant.launcherRefs.dictionary.current?.focus();
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
            assistant.launcherRefs.dictionary.current?.focus();
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
      // Keyed by word so the local favorite toggle (visual-only, no backend
      // persistence — see DictionaryResultView) never leaks from one looked
      // -up word onto the next.
      return <DictionaryResultView key={state.data.word} data={state.data} t={t} />;
    default:
      return null;
  }
};

const playAudio = (url: string) => {
  const audio = new Audio(url);
  void audio.play().catch(() => undefined);
};

// Presentational only — part-of-speech -> tag/card tint. Falls back to a
// neutral slate tint for any value this map doesn't recognize (the source
// API is free-text, not a closed enum) rather than skipping the tint.
const POS_STYLES: Record<string, { tag: string; card: string }> = {
  VERB: {
    tag: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
    card: 'bg-green-50 dark:bg-green-500/5',
  },
  NOUN: {
    tag: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
    card: 'bg-purple-50 dark:bg-purple-500/5',
  },
  ADJECTIVE: {
    tag: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    card: 'bg-amber-50 dark:bg-amber-500/5',
  },
  ADVERB: {
    tag: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    card: 'bg-sky-50 dark:bg-sky-500/5',
  },
};
const DEFAULT_POS_STYLE = {
  tag: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  card: 'bg-slate-50 dark:bg-slate-800/60',
};

// Compact abbreviations for the closed backend PartOfSpeech enum. An
// EXTERNAL-tier value is free text from freedictionaryapi.com (not this
// enum), so an unrecognized value falls back to showing itself verbatim
// rather than being hidden.
const POS_ABBREVIATIONS: Record<string, string> = {
  NOUN: 'n.',
  VERB: 'v.',
  ADJECTIVE: 'adj.',
  ADVERB: 'adv.',
  PRONOUN: 'pron.',
  PREPOSITION: 'prep.',
  CONJUNCTION: 'conj.',
  INTERJECTION: 'interj.',
  DETERMINER: 'det.',
  PHRASE: 'phr.',
  IDIOM: 'idiom',
};

interface MeaningGroup {
  partOfSpeech: string | null;
  /** Curated Vietnamese senses (VOCAB_WORD only), deduplicated. */
  viMeanings: string[];
  /** English-English definitions (EXTERNAL/DICTIONARY_CACHE only), deduplicated. */
  enDefinitions: string[];
  /** Example sentences, deduplicated. */
  examples: string[];
}

// 2026-08-21 bug fix, round 2 — grouping by part of speech is what collapses
// what used to be one repeated tag ("NOUN" x3) per meaning into ONE tag per
// distinct part of speech (a word that is genuinely both a noun and a verb
// still gets two separate groups). Within a group, content is split by
// LANGUAGE/kind rather than numbered "Meaning 1/2/3" labels that mixed
// Vietnamese senses, an English-English definition and its own Vietnamese
// re-translation in one flat, unlabelled list — see the 2026-08-21 UX
// report. `definitionVi` and `definitionEn` are already mutually exclusive
// per meaning (VOCAB_WORD only ever fills the former, EXTERNAL/CACHE only
// the latter — see dictionary.service.ts), so a group naturally ends up
// showing only the section(s) it actually has data for.
const groupMeanings = (meanings: DictionaryMeaning[]): MeaningGroup[] => {
  const groups: MeaningGroup[] = [];
  const pushUnique = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };

  for (const meaning of meanings) {
    let group = groups.find((g) => g.partOfSpeech === meaning.partOfSpeech);
    if (!group) {
      group = { partOfSpeech: meaning.partOfSpeech, viMeanings: [], enDefinitions: [], examples: [] };
      groups.push(group);
    }
    if (meaning.definitionVi) pushUnique(group.viMeanings, meaning.definitionVi);
    if (meaning.definitionEn) pushUnique(group.enDefinitions, meaning.definitionEn);
    if (meaning.exampleEn) pushUnique(group.examples, meaning.exampleEn);
  }

  // Never render a card with nothing in it.
  return groups.filter(
    (g) => g.viMeanings.length > 0 || g.enDefinitions.length > 0 || g.examples.length > 0,
  );
};

// A single item renders as one plain line; two or more render as a numbered
// list — the numbering is what used to be the "Meaning N" label, now scoped
// to one language section instead of the whole (mixed-language) card.
const MeaningTextList: React.FC<{ items: string[]; className: string; quoted?: boolean }> = ({
  items,
  className,
  quoted,
}) => {
  const render = (text: string) => (quoted ? `“${text}”` : text);
  if (items.length === 1) {
    return <p className={className}>{render(items[0])}</p>;
  }
  return (
    <ol className="space-y-0.5">
      {items.map((item, index) => (
        <li key={index} className={className}>
          <span className="font-semibold mr-1">{index + 1}.</span>
          {render(item)}
        </li>
      ))}
    </ol>
  );
};

const DictionaryResultView: React.FC<{ data: DictionaryLookupResult; t: TranslationDict }> = ({
  data,
  t,
}) => {
  const assistant = useAssistant();
  // Visual-only — no backend field/endpoint exists to persist a favorite
  // word yet, so this resets whenever a fresh lookup remounts this
  // component (see the `key={data.word}` above it in DictionaryPanelBody).
  const [isFavorite, setIsFavorite] = useState(false);
  // A lookup that came from a real Wiktionary source, not the curated
  // VocabWord bank — that's exactly when a Wiktionary/FreeDictionaryAPI.com
  // attribution line is required. See free-dictionary-api.provider.ts's
  // header comment on the backend for the license this satisfies.
  const showAttribution = data.source !== 'VOCAB_WORD';

  // Phase C hand-off — only a REAL VocabWord hit gets a VOCAB_WORD context
  // (a resourceId the backend can actually re-resolve/re-authorize); a
  // tier-2/3 result still hands off the panel + prefilled question, just
  // with GENERAL context, rather than echoing this client-held definition
  // to the server as if it were an already-validated resource.
  const handleAskEngy = () => {
    assistant?.handoffToChat({
      prefillMessage: t.dictionary.askEngyPrefill.replace('{{word}}', data.word),
      context: data.vocabWordId
        ? { type: 'VOCAB_WORD', resourceId: data.vocabWordId }
        : { type: 'GENERAL' },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
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
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
              {data.word}
            </p>
            <button
              type="button"
              onClick={() => setIsFavorite((prev) => !prev)}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? t.dictionary.favoriteRemove : t.dictionary.favoriteAdd}
              className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            >
              <Star
                size={16}
                fill={isFavorite ? 'currentColor' : 'none'}
                className={isFavorite ? 'text-amber-400' : ''}
              />
            </button>
          </div>
          {data.ipa && <p className="text-sm text-slate-500 dark:text-slate-400">{data.ipa}</p>}
        </div>
      </div>

      {/* VOCAB_WORD's quick headline would just repeat the "Nghĩa tiếng Việt"
          section's own first line below (both read firstMeaning.meaning) —
          shown only for EXTERNAL/CACHE, whose only Vietnamese text IS this
          line (per-meaning definitionVi is never populated for that tier). */}
      {data.viTranslation && data.source !== 'VOCAB_WORD' && (
        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{data.viTranslation}</p>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800" />

      <div className="space-y-2">
        {groupMeanings(data.meanings).map((group) => {
          const style = group.partOfSpeech
            ? (POS_STYLES[group.partOfSpeech.toUpperCase()] ?? DEFAULT_POS_STYLE)
            : DEFAULT_POS_STYLE;
          const tagLabel = group.partOfSpeech
            ? (POS_ABBREVIATIONS[group.partOfSpeech.toUpperCase()] ?? group.partOfSpeech)
            : null;
          return (
            <div
              key={group.partOfSpeech ?? 'unlabelled'}
              className={`rounded-xl p-2.5 text-sm space-y-2 ${style.card}`}
            >
              {tagLabel && (
                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${style.tag}`}>
                  {tagLabel}
                </span>
              )}
              {group.viMeanings.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    {t.dictionary.vietnameseMeaning}
                  </p>
                  <MeaningTextList items={group.viMeanings} className="text-slate-700 dark:text-slate-200" />
                </div>
              )}
              {group.enDefinitions.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    {t.dictionary.englishDefinitionLabel}
                  </p>
                  <MeaningTextList items={group.enDefinitions} className="text-slate-700 dark:text-slate-200" />
                </div>
              )}
              {group.examples.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    {t.dictionary.exampleLabel}
                  </p>
                  <MeaningTextList
                    items={group.examples}
                    className="text-slate-500 dark:text-slate-400 italic"
                    quoted
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAskEngy}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <MessageCircle size={18} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left text-sm font-semibold">{t.dictionary.askEngy}</span>
        <ChevronRight size={18} className="shrink-0" aria-hidden="true" />
      </button>

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
