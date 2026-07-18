import { Course, CourseType, ManagedCourse } from '../types';
import { throwApiError } from './apiError';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface CourseListResponse {
  data: Course[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ManagedCourseListResponse {
  data: ManagedCourse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateCourseDto {
  title: string;
  type: CourseType;
  description: string;
  thumbnail?: string;
}

export interface UpdateCourseDto {
  title?: string;
  type?: CourseType;
  description?: string;
  thumbnail?: string;
}

const getAuthHeader = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Authorization': `Bearer ${token}`,
  };
};

// Get published courses (public, no auth required)
export const getPublishedCourses = async (
  page?: number,
  limit?: number,
  type?: CourseType,
): Promise<CourseListResponse> => {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (type) params.set('type', type);

  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/courses${query ? `?${query}` : ''}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load courses');
  }

  return response.json();
};

// Get a single published course by id (public, no auth required)
export const getPublishedCourse = async (id: string): Promise<Course> => {
  const response = await fetch(`${API_BASE_URL}/courses/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load course');
  }

  return response.json();
};

// --- Admin-only functions (ADMIN role required server-side) ---

// List all courses including drafts (GET /courses/manage).
export const getManagedCourses = async (
  page?: number,
  limit?: number,
  type?: CourseType,
): Promise<ManagedCourseListResponse> => {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (type) params.set('type', type);

  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/courses/manage${query ? `?${query}` : ''}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to load courses');
  return response.json();
};

// Create a course (always starts as an unpublished draft).
export const createCourse = async (dto: CreateCourseDto): Promise<Course> => {
  const response = await fetch(`${API_BASE_URL}/courses`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to create course');
  return response.json();
};

export const updateCourse = async (id: string, dto: UpdateCourseDto): Promise<Course> => {
  const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update course');
  return response.json();
};

export const publishCourse = async (id: string): Promise<Course> => {
  const response = await fetch(`${API_BASE_URL}/courses/${id}/publish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to publish course');
  return response.json();
};

export const unpublishCourse = async (id: string): Promise<Course> => {
  const response = await fetch(`${API_BASE_URL}/courses/${id}/unpublish`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to unpublish course');
  return response.json();
};

// Delete a course (DELETE /courses/:id -> 204 No Content). No body to parse.
// The backend rejects (400) if the course still has lessons — surface
// error.message to the admin as-is so they know to remove lessons first.
export const deleteCourse = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/courses/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!response.ok) return throwApiError(response, 'Failed to delete course');
};
