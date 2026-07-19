import { VocabLibrary, ManagedVocabLibrary } from '../types';
import { throwApiError } from './apiError';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface VocabLibraryListResponse {
  data: VocabLibrary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ManagedVocabLibraryListResponse {
  data: ManagedVocabLibrary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateVocabLibraryDto {
  name: string;
  description: string;
  thumbnail?: string;
}

export interface UpdateVocabLibraryDto {
  name?: string;
  description?: string;
  thumbnail?: string;
}

const getAuthHeader = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Authorization': `Bearer ${token}`,
  };
};

// Get published libraries (public, no auth required — the anonymous-browsable shelf).
export const getPublishedLibraries = async (
  page?: number,
  limit?: number,
): Promise<VocabLibraryListResponse> => {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/vocab/libraries${query ? `?${query}` : ''}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load vocabulary libraries');
  }

  return response.json();
};

// Get a single published library by id (public, no auth required).
export const getPublishedLibrary = async (id: string): Promise<VocabLibrary> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load vocabulary library');
  }

  return response.json();
};

// --- Admin-only functions (ADMIN role required server-side) ---

// List all libraries including drafts (GET /vocab/libraries/manage).
export const getManagedLibraries = async (
  page?: number,
  limit?: number,
): Promise<ManagedVocabLibraryListResponse> => {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/manage${query ? `?${query}` : ''}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to load vocabulary libraries');
  return response.json();
};

// Create a library (always starts as an unpublished draft).
export const createLibrary = async (dto: CreateVocabLibraryDto): Promise<VocabLibrary> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to create vocabulary library');
  return response.json();
};

export const updateLibrary = async (id: string, dto: UpdateVocabLibraryDto): Promise<VocabLibrary> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${id}`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update vocabulary library');
  return response.json();
};

export const publishLibrary = async (id: string): Promise<VocabLibrary> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${id}/publish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to publish vocabulary library');
  return response.json();
};

export const unpublishLibrary = async (id: string): Promise<VocabLibrary> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${id}/unpublish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to unpublish vocabulary library');
  return response.json();
};

// Delete a library (DELETE /vocab/libraries/:id -> 204 No Content). No body to parse.
// The backend rejects (400) if the library still has decks — surface
// error.message to the admin as-is so they know to remove decks first.
export const deleteLibrary = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/vocab/libraries/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to delete vocabulary library');
};
