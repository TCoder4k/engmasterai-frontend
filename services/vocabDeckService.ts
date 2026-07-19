import {
  VocabDeck,
  ManagedVocabDeck,
  CefrLevel,
  VocabWordListItem,
  ManagedVocabDeckWordRow,
} from '../types';
import { throwApiError } from './apiError';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Unlike VocabLibraryListResponse, this has no `meta` — a library's deck set
// is small and unpaginated by design (same judgment call as Lesson's
// per-course list). Do not add pagination UI around this response.
export interface VocabDeckListResponse {
  data: VocabDeck[];
}

export interface ManagedVocabDeckListResponse {
  data: ManagedVocabDeck[];
}

// Also unpaginated by design — decks are curated study units, and every
// deck's word count is now structurally bounded by the backend's
// MAX_DECK_WORDS attach cap. Do not add pagination UI around these either.
export interface VocabWordListResponse {
  data: VocabWordListItem[];
}

export interface ManagedVocabDeckWordListResponse {
  data: ManagedVocabDeckWordRow[];
}

export interface AttachWordsResult {
  data: {
    attachedCount: number;
    skippedCount: number;
  };
}

export interface CreateVocabDeckDto {
  name: string;
  description?: string;
  thumbnail?: string;
  cefrLevel?: CefrLevel;
}

export interface UpdateVocabDeckDto {
  name?: string;
  description?: string;
  thumbnail?: string;
  cefrLevel?: CefrLevel;
}

const getAuthHeader = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Authorization': `Bearer ${token}`,
  };
};

// Single published deck (requires deck + its library both published;
// GET /vocab/decks/:id). The Phase 1 scope-cut endpoint, added back in
// Phase 2 now that DeckDetailPage is its consumer.
export const getPublishedDeck = async (id: string): Promise<VocabDeck> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${id}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load vocabulary deck');
  }

  return response.json();
};

// Deck's words for dictionary-mode browsing (requires deck + library both
// published; GET /vocab/decks/:deckId/words).
export const getPublishedDeckWords = async (deckId: string): Promise<VocabWordListResponse> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${deckId}/words`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load deck words');
  }

  return response.json();
};

// Get the published decks of a library, ordered by orderIndex (requires
// auth — unlike the public library catalog, entering a deck is the first
// step into the learning experience proper).
export const getPublishedDecksByLibrary = async (libraryId: string): Promise<VocabDeckListResponse> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${libraryId}/decks`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load vocabulary decks');
  }

  return response.json();
};

// --- Admin-only functions (ADMIN role required server-side) ---

// All decks for a library including drafts, ordered by orderIndex
// (GET /vocab/libraries/:libraryId/decks/manage). Unpaginated — see note above.
export const getManagedDecksByLibrary = async (libraryId: string): Promise<ManagedVocabDeckListResponse> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${libraryId}/decks/manage`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to load vocabulary decks');
  return response.json();
};

// Create a deck (auto-appended orderIndex; always starts as an unpublished draft).
export const createDeck = async (libraryId: string, dto: CreateVocabDeckDto): Promise<ManagedVocabDeck> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${libraryId}/decks`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to create vocabulary deck');
  return response.json();
};

export const updateDeck = async (id: string, dto: UpdateVocabDeckDto): Promise<ManagedVocabDeck> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${id}`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update vocabulary deck');
  return response.json();
};

// Phase 2: the backend now rejects (400) publishing a deck with zero words
// attached — surface error.message as-is so the admin knows to attach a
// word first. A deck already published empty under Phase 1's looser rule
// stays published (additive guard, not retroactive).
export const publishDeck = async (id: string): Promise<ManagedVocabDeck> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${id}/publish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to publish vocabulary deck');
  return response.json();
};

export const unpublishDeck = async (id: string): Promise<ManagedVocabDeck> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${id}/unpublish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to unpublish vocabulary deck');
  return response.json();
};

// Delete a deck (DELETE /vocab/decks/:id -> 204 No Content). No body to parse.
// The backend rejects (400) while the deck is still published — surface
// error.message to the admin as-is so they know to unpublish first.
export const deleteDeck = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to delete vocabulary deck');
};

// All words attached to a deck, in deck order, regardless of publish state
// (GET /vocab/decks/:deckId/words/manage). Unpaginated — see note above.
export const getManagedDeckWords = async (deckId: string): Promise<ManagedVocabDeckWordListResponse> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${deckId}/words/manage`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to load deck words');
  return response.json();
};

// Batch attach existing words into a deck. The backend deduplicates the
// incoming ids, rejects unknown ids (400), rejects exceeding the deck's
// MAX_DECK_WORDS cap (400), and skips already-attached ids rather than
// erroring on them.
export const attachWords = async (deckId: string, wordIds: string[]): Promise<AttachWordsResult> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${deckId}/words`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ wordIds }),
  });

  if (!response.ok) return throwApiError(response, 'Failed to attach words');
  return response.json();
};

// Detach a word from a deck (DELETE .../words/:wordId -> 204). The backend
// rejects (400) detaching the last word of a published deck — surface
// error.message as-is so the admin knows to unpublish first.
export const detachWord = async (deckId: string, wordId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/vocab/decks/${deckId}/words/${wordId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to detach word');
};
