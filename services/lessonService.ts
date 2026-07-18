import { Lesson, ManagedLesson } from '../types';
import { throwApiError } from './apiError';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface LessonListResponse {
  data: Lesson[];
}

// Unlike CourseListResponse/UserListResponse, this has no `meta` — a
// course's lesson set is small and unpaginated by design (see Lesson module
// architecture decisions). Do not add pagination UI around this response.
export interface ManagedLessonListResponse {
  data: ManagedLesson[];
}

export interface CreateLessonDto {
  title: string;
  description?: string;
  notes?: string;
  videoUrl?: string;
  pdfUrl?: string;
  audioUrl?: string;
  videoDurationMinutes?: number;
  estimatedStudyMinutes?: number;
  learningObjectives?: string[];
}

export interface UpdateLessonDto {
  title?: string;
  description?: string;
  notes?: string;
  videoUrl?: string;
  pdfUrl?: string;
  audioUrl?: string;
  videoDurationMinutes?: number;
  estimatedStudyMinutes?: number;
  learningObjectives?: string[];
}

// Get auth token and header
const getAuthHeader = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Authorization': `Bearer ${token}`
  };
};

// Get the published lessons of a course, ordered by orderIndex (requires auth)
export const getCourseLessons = async (courseId: string): Promise<LessonListResponse> => {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/lessons`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load lessons');
  }

  return response.json();
};

// Get a single published lesson by id (requires auth)
export const getLesson = async (id: string): Promise<Lesson> => {
  const response = await fetch(`${API_BASE_URL}/lessons/${id}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load lesson');
  }

  return response.json();
};

// --- Admin-only functions (ADMIN role required server-side) ---

// All lessons for a course including drafts, ordered by orderIndex
// (GET /courses/:courseId/lessons/manage). Unpaginated — see note above.
export const getManagedLessons = async (courseId: string): Promise<ManagedLessonListResponse> => {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/lessons/manage`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to load lessons');
  return response.json();
};

// Create a lesson (auto-appended orderIndex; always starts as an
// unpublished draft).
export const createLesson = async (courseId: string, dto: CreateLessonDto): Promise<ManagedLesson> => {
  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/lessons`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to create lesson');
  return response.json();
};

export const updateLesson = async (id: string, dto: UpdateLessonDto): Promise<ManagedLesson> => {
  const response = await fetch(`${API_BASE_URL}/lessons/${id}`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update lesson');
  return response.json();
};

// The backend rejects (400) publishing a lesson with neither videoUrl nor
// audioUrl set — surface error.message as-is so the admin knows why.
export const publishLesson = async (id: string): Promise<ManagedLesson> => {
  const response = await fetch(`${API_BASE_URL}/lessons/${id}/publish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to publish lesson');
  return response.json();
};

export const unpublishLesson = async (id: string): Promise<ManagedLesson> => {
  const response = await fetch(`${API_BASE_URL}/lessons/${id}/unpublish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to unpublish lesson');
  return response.json();
};

// Delete a lesson (DELETE /lessons/:id -> 204 No Content). No body to parse.
// The backend rejects (400) if the lesson still has tasks.
export const deleteLesson = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/lessons/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to delete lesson');
};
