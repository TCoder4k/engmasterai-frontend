import { Lesson } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface LessonListResponse {
  data: Lesson[];
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
