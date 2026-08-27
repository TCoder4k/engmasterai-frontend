import { useEffect, useMemo, useState } from 'react';
import { getPersonalVocabWordsSavedStatus } from '../../../services/vocabPersonalService';

const normalize = (text: string): string => text.trim().toLowerCase();

export interface UsePersonalWordSaveStatusResult {
  isSaved: (text: string) => boolean;
  getSavedId: (text: string) => string | undefined;
  markSaved: (text: string, id: string) => void;
  markUnsaved: (text: string) => void;
}

// Batch-checks "is this word already in My Vocabulary" for a page's current
// word list ONCE — not per row, which would be an N+1 request storm on a
// 20-50 word deck page. Used by every universal-star call site (Dictionary
// panel, DeckDetailPage, WordDetailPage, FlashcardSession, ...).
//
// Re-fetch trigger, precisely: `dependencyKey` is a stable string built from
// the de-duplicated, normalized, SORTED texts. The status-fetching effect
// depends on that STRING, not on `texts`' array identity — a caller that
// does `words.map(w => w.text)` inline creates a brand-new array every
// render, but the joined string only actually changes when the underlying
// set of words does (a real refetch, pagination, a search filter) — never on
// an unrelated re-render, e.g. this same hook's own markSaved/markUnsaved
// updating local state after a star click.
export function usePersonalWordSaveStatus(texts: string[]): UsePersonalWordSaveStatusResult {
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());

  const normalizedUniqueTexts = useMemo(
    () => [...new Set(texts.map(normalize))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texts],
  );
  const dependencyKey = useMemo(
    () => [...normalizedUniqueTexts].sort().join('|'),
    [normalizedUniqueTexts],
  );

  useEffect(() => {
    if (normalizedUniqueTexts.length === 0) {
      setStatusMap(new Map());
      return;
    }
    let cancelled = false;
    getPersonalVocabWordsSavedStatus(normalizedUniqueTexts)
      .then((result) => {
        if (cancelled) return;
        const next = new Map<string, string>();
        for (const [normalized, entry] of Object.entries(result)) {
          if (entry.saved) next.set(normalized, entry.id);
        }
        setStatusMap(next);
      })
      .catch(() => {
        // Best-effort — a failed status check just means every star starts
        // as "unsaved"; clicking one still resolves correctly via
        // toggleSavedWord's own 409 fallback.
      });
    return () => {
      cancelled = true;
    };
    // Deliberately keyed on the stable string, not `normalizedUniqueTexts` —
    // see the header comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return {
    isSaved: (text: string) => statusMap.has(normalize(text)),
    getSavedId: (text: string) => statusMap.get(normalize(text)),
    markSaved: (text: string, id: string) => {
      setStatusMap((prev) => new Map(prev).set(normalize(text), id));
    },
    markUnsaved: (text: string) => {
      setStatusMap((prev) => {
        const next = new Map(prev);
        next.delete(normalize(text));
        return next;
      });
    },
  };
}
