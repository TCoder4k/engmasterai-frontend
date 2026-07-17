import { Course, CourseType } from '../types';

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
