import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface DictionaryMeaning {
  partOfSpeech: string | null;
  definitionEn: string | null;
  exampleEn: string | null;
}

export type DictionarySource = 'VOCAB_WORD' | 'DICTIONARY_CACHE' | 'EXTERNAL';
export type ViTranslationSource = 'NONE' | 'AI' | 'CURATED';

export interface DictionaryLookupResult {
  word: string;
  normalizedWord: string;
  ipa: string | null;
  audioUrl: string | null;
  meanings: DictionaryMeaning[];
  synonyms: string[];
  viTranslation: string | null;
  viTranslationSource: ViTranslationSource;
  sourceUrl: string | null;
  source: DictionarySource;
  vocabWordId: string | null;
}

// GET /dictionary/lookup?q=... — deterministic word lookup, never fabricated.
//
// No AbortSignal here: apiFetch -> fetchWithTimeout always builds its OWN
// AbortController and never honours a caller-supplied `signal` (it
// overwrites `signal` after spreading `init`), so threading one through
// would silently do nothing. A superseded lookup is instead ignored at the
// call site (DictionaryPanel tracks the latest request and discards a
// stale response when it resolves) rather than actually cancelled.
export const lookupWord = async (query: string): Promise<DictionaryLookupResult> => {
  const qs = new URLSearchParams({ q: query });
  const response = await apiFetch(`${API_BASE_URL}/dictionary/lookup?${qs}`);

  if (!response.ok) return throwApiError(response, 'Failed to look up word');
  return response.json();
};
