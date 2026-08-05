import { CefrLevel } from '../types';
import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Sprint 11 — the admin Listening API surface.
//
// ADMIN-ONLY. Every route below is @Roles(ADMIN) server-side; the
// ProtectedRoute wrapper on /admin/* is a UX gate, not the enforcement.
//
// NO GAMIFICATION PUBLISH HERE, deliberately. The five services that call
// publishGamificationResult do so because their endpoints return an ephemeral
// `gamification` envelope; authoring content awards nothing, so there is no
// envelope to forget and no silent failure to guard against. That changes in
// Phase 6, and the service-level test for it belongs here when it does.
//
// Ids are UUIDs everywhere. Listening deliberately introduced no slug: every
// other id in this codebase is a UUID and every student route parses one with
// ParseUUIDPipe.

export type ListeningMode = 'DICTATION' | 'SHADOWING';
export type ListeningMediaType = 'VIDEO' | 'AUDIO';
export type ListeningMediaProvider = 'YOUTUBE' | 'CLOUDINARY' | 'EXTERNAL_URL';

export interface ManagedListeningCategory {
  id: string;
  name: string;
  nameVi: string;
  orderIndex: number;
  isPublished: boolean;
  contentCount: number;
}

export interface ManagedListeningSegment {
  id: string;
  orderIndex: number;
  text: string;
  ipa: string | null;
  translationVi: string | null;
  notes: string | null;
  startTimeMs: number;
  endTimeMs: number;
}

export interface ManagedListeningContentSummary {
  id: string;
  title: string;
  level: CefrLevel;
  mediaProvider: ListeningMediaProvider;
  mediaType: ListeningMediaType;
  supportedModes: ListeningMode[];
  orderIndex: number;
  isPublished: boolean;
  segmentCount: number;
  category: {
    id: string;
    name: string;
    nameVi: string;
    orderIndex: number;
    isPublished: boolean;
  };
  updatedAt: string;
}

export interface ManagedListeningContent {
  id: string;
  title: string;
  description: string | null;
  level: CefrLevel;
  thumbnailUrl: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  mediaType: ListeningMediaType;
  mediaProvider: ListeningMediaProvider;
  mediaUrl: string;
  externalMediaId: string | null;
  durationMs: number | null;
  supportedModes: ListeningMode[];
  orderIndex: number;
  isPublished: boolean;
  categoryId: string;
  category: ManagedListeningCategory;
  segmentCount: number;
  segments: ManagedListeningSegment[];
  createdAt: string;
  updatedAt: string;
}

export interface ManagedListeningContentListResponse {
  data: ManagedListeningContentSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateListeningCategoryPayload {
  name: string;
  nameVi: string;
  orderIndex?: number;
}

export interface UpdateListeningCategoryPayload {
  name?: string;
  nameVi?: string;
  orderIndex?: number;
}

export interface CreateListeningContentPayload {
  categoryId: string;
  title: string;
  description?: string;
  level: CefrLevel;
  thumbnailUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  mediaType: ListeningMediaType;
  mediaProvider: ListeningMediaProvider;
  mediaUrl: string;
  externalMediaId?: string;
  durationMs?: number;
  supportedModes: ListeningMode[];
}

export type UpdateListeningContentPayload = Partial<CreateListeningContentPayload>;

/**
 * One entry of the whole-document segment PUT.
 *
 * `id` PRESENT means "update this row in place"; absent means "create". The
 * editor must send back the id of every sentence it did not delete — dropping
 * it silently recreates the row, which from Phase 4A would destroy the
 * student progress and attempt history that cascade from it.
 */
export interface SegmentDocumentEntry {
  id?: string;
  text: string;
  ipa?: string;
  translationVi?: string;
  notes?: string;
  startTimeMs: number;
  endTimeMs: number;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

// --- categories --------------------------------------------------------------

export const getListeningCategories = async (): Promise<
  ManagedListeningCategory[]
> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/categories`);
  if (!response.ok) return throwApiError(response, 'Không tải được danh mục Listening');
  return response.json();
};

export const createListeningCategory = async (
  payload: CreateListeningCategoryPayload,
): Promise<ManagedListeningCategory> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/categories`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không tạo được danh mục');
  return response.json();
};

export const updateListeningCategory = async (
  id: string,
  payload: UpdateListeningCategoryPayload,
): Promise<ManagedListeningCategory> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/categories/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không cập nhật được danh mục');
  return response.json();
};

export const publishListeningCategory = async (
  id: string,
): Promise<ManagedListeningCategory> => {
  const response = await apiFetch(
    `${API_BASE_URL}/listening/manage/categories/${id}/publish`,
    { method: 'PATCH' },
  );
  if (!response.ok) return throwApiError(response, 'Không xuất bản được danh mục');
  return response.json();
};

export const unpublishListeningCategory = async (
  id: string,
): Promise<ManagedListeningCategory> => {
  const response = await apiFetch(
    `${API_BASE_URL}/listening/manage/categories/${id}/unpublish`,
    { method: 'PATCH' },
  );
  if (!response.ok) return throwApiError(response, 'Không gỡ xuất bản được danh mục');
  return response.json();
};

// 204 No Content — nothing to parse. The backend refuses (400) while the
// category still holds content; surface its message as-is so the admin knows
// to move or delete the recordings first.
export const deleteListeningCategory = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/categories/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) return throwApiError(response, 'Không xóa được danh mục');
};

// --- contents ----------------------------------------------------------------

export const getListeningContents = async (
  page?: number,
  limit?: number,
  categoryId?: string,
): Promise<ManagedListeningContentListResponse> => {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (categoryId) params.set('categoryId', categoryId);

  const query = params.toString();
  const response = await apiFetch(
    `${API_BASE_URL}/listening/manage/contents${query ? `?${query}` : ''}`,
  );
  if (!response.ok) return throwApiError(response, 'Không tải được nội dung Listening');
  return response.json();
};

export const getListeningContent = async (
  id: string,
): Promise<ManagedListeningContent> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/contents/${id}`);
  if (!response.ok) return throwApiError(response, 'Không tải được nội dung');
  return response.json();
};

export const createListeningContent = async (
  payload: CreateListeningContentPayload,
): Promise<ManagedListeningContent> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/contents`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không tạo được nội dung');
  return response.json();
};

export const updateListeningContent = async (
  id: string,
  payload: UpdateListeningContentPayload,
): Promise<ManagedListeningContent> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/contents/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response, 'Không cập nhật được nội dung');
  return response.json();
};

/**
 * Whole-document segment save. The array's ORDER becomes orderIndex, so this
 * is also how reordering is performed — there is no reorder endpoint.
 */
export const saveListeningSegments = async (
  contentId: string,
  segments: SegmentDocumentEntry[],
): Promise<ManagedListeningContent> => {
  const response = await apiFetch(
    `${API_BASE_URL}/listening/manage/contents/${contentId}/segments`,
    {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ segments }),
    },
  );
  if (!response.ok) return throwApiError(response, 'Không lưu được danh sách câu');
  return response.json();
};

// The backend refuses with a specific reason (missing media, no segments,
// overlapping timings, draft category...). throwApiError carries that message
// through, and the editor renders it verbatim — a generic "publish failed"
// would hide the one thing the admin needs to know.
export const publishListeningContent = async (
  id: string,
): Promise<ManagedListeningContent> => {
  const response = await apiFetch(
    `${API_BASE_URL}/listening/manage/contents/${id}/publish`,
    { method: 'PATCH' },
  );
  if (!response.ok) return throwApiError(response, 'Không xuất bản được nội dung');
  return response.json();
};

export const unpublishListeningContent = async (
  id: string,
): Promise<ManagedListeningContent> => {
  const response = await apiFetch(
    `${API_BASE_URL}/listening/manage/contents/${id}/unpublish`,
    { method: 'PATCH' },
  );
  if (!response.ok) return throwApiError(response, 'Không gỡ xuất bản được nội dung');
  return response.json();
};

export const deleteListeningContent = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/listening/manage/contents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) return throwApiError(response, 'Không xóa được nội dung');
};
