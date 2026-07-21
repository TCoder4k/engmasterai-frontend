import {
  ManagedVocabWordRow,
  ManagedVocabWord,
  VocabWordDetail,
  CefrLevel,
  PartOfSpeech,
} from '../types';
import { throwApiError, ApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ManagedVocabWordListResponse {
  data: ManagedVocabWordRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface QueryVocabWordParams {
  page?: number;
  limit?: number;
  search?: string;
  cefrLevel?: CefrLevel;
}

export interface WordMeaningDto {
  partOfSpeech?: PartOfSpeech;
  meaning: string;
}

export interface WordExampleDto {
  sentence: string;
  translation?: string;
}

export interface CreateVocabWordDto {
  text: string;
  ipa?: string;
  audioUrl?: string;
  imageUrl?: string;
  cefrLevel?: CefrLevel;
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  wordFamily?: string[];
  meanings: WordMeaningDto[];
  examples?: WordExampleDto[];
}

// Nullable fields carry `| null` explicitly — the editor sends null to
// clear them (the backend's null-vs-undefined convention: null clears a
// nullable field, omitting a key leaves it unchanged). Arrays/meanings/
// examples are cleared with `[]`, never null — see vocab-word.service.ts's
// UpdateVocabWordDto on the backend for the full rule.
export interface UpdateVocabWordDto {
  text?: string;
  ipa?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  cefrLevel?: CefrLevel | null;
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  wordFamily?: string[];
  meanings?: WordMeaningDto[];
  examples?: WordExampleDto[];
}

export interface CsvImportRowError {
  row: number;
  message: string;
}

export interface CsvImportResult {
  data: {
    createdCount: number;
    skippedCount: number;
  };
}

// --- Admin-only functions (ADMIN role required server-side) ---

export const getManagedWords = async (
  params: QueryVocabWordParams = {},
): Promise<ManagedVocabWordListResponse> => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.cefrLevel) query.set('cefrLevel', params.cefrLevel);

  const qs = query.toString();
  const response = await apiFetch(`${API_BASE_URL}/vocab/words/manage${qs ? `?${qs}` : ''}`);

  if (!response.ok) return throwApiError(response, 'Failed to load word bank');
  return response.json();
};

// The codebase's first admin single-item GET — the word editor page needs
// a deep-linkable/refresh-safe load, unlike the modal-based admin pages
// that seed from an already-fetched list row.
export const getManagedWord = async (id: string): Promise<ManagedVocabWord> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab/words/manage/${id}`);

  if (!response.ok) return throwApiError(response, 'Failed to load word');
  return response.json();
};

export const createWord = async (dto: CreateVocabWordDto): Promise<ManagedVocabWord> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to create word');
  return response.json();
};

export const updateWord = async (id: string, dto: UpdateVocabWordDto): Promise<ManagedVocabWord> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab/words/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update word');
  return response.json();
};

// Delete a word (DELETE /vocab/words/:id -> 204). The backend rejects (400)
// while the word is attached to any deck — surface error.message as-is so
// the admin knows to detach it first.
export const deleteWord = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab/words/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) return throwApiError(response, 'Failed to delete word');
};

// CSV bulk import. Unlike throwApiError, this reads the full error body so
// per-row validation errors can be surfaced in the import modal's report
// rather than collapsed into a single generic message.
export const importWordsCsv = async (file: File): Promise<CsvImportResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(`${API_BASE_URL}/vocab/words/import`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = 'Failed to import CSV';
    let rowErrors: CsvImportRowError[] | undefined;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      if (Array.isArray(body?.errors)) rowErrors = body.errors;
    } catch {
      // Empty/non-JSON error body — keep the fallback message.
    }
    if (rowErrors && rowErrors.length > 0) {
      message += ': ' + rowErrors.map((e) => `Row ${e.row}: ${e.message}`).join('; ');
    }
    throw new ApiError(message, response.status);
  }

  return response.json();
};

export const uploadWordAudio = async (id: string, file: File): Promise<ManagedVocabWord> => {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await apiFetch(`${API_BASE_URL}/vocab/words/${id}/audio`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) return throwApiError(response, 'Failed to upload audio');
  return response.json();
};

export const uploadWordImage = async (id: string, file: File): Promise<ManagedVocabWord> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await apiFetch(`${API_BASE_URL}/vocab/words/${id}/image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) return throwApiError(response, 'Failed to upload image');
  return response.json();
};

// --- Student (any authenticated user) ---

// The visibility seam: 404s unless the word sits on >=1 published deck of a
// published library.
export const getWord = async (id: string): Promise<VocabWordDetail> => {
  const response = await apiFetch(`${API_BASE_URL}/vocab/words/${id}`);

  if (!response.ok) return throwApiError(response, 'Failed to load word');
  return response.json();
};
