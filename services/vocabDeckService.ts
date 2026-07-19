import { VocabDeck, ManagedVocabDeck, CefrLevel } from '../types';
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

// Get the published decks of a library, ordered by orderIndex (requires
// auth — unlike the public library catalog, entering a deck is the first
// step into the learning experience proper). No getDeck(id) — there is no
// backing single-deck endpoint this phase (see Phase 1 plan's Scope Reduction).
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

// Phase 1: the backend has no content guard yet, so this always succeeds
// (a deck can publish with zero words this phase — see Phase 1 plan's
// Handoff #2). Phase 2 adds a "needs ≥1 word" guard for newly published decks.
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
