import { throwApiError } from './apiError';
import { apiFetch } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  totalPoints: number;
  level: number;
  createdAt: string;
  // Sprint 02B — derived server-side from emailVerifiedAt !== null.
  emailVerified: boolean;
}

export interface UserListResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
}

// Admin-only fields (PUT /users/:id) — a regular user can never set these
// via PUT /users/me (see backend UpdateProfileDto vs AdminUpdateUserDto).
export interface AdminUpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: 'USER' | 'ADMIN';
  level?: number;
  totalPoints?: number;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// Get current user profile
export const getProfile = async (): Promise<User> => {
  const response = await apiFetch(`${API_BASE_URL}/users/me`);
  if (!response.ok) return throwApiError(response, 'Failed to load profile');
  return response.json();
};

// Update user profile (name, email, password)
export const updateProfile = async (data: UpdateUserDto): Promise<User> => {
  const response = await apiFetch(`${API_BASE_URL}/users/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update profile');
  return response.json();
};

// Upload avatar
export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await apiFetch(`${API_BASE_URL}/users/me/avatar`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) return throwApiError(response, 'Failed to upload avatar');
  return response.json();
};

// Change password with current password verification
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> => {
  const response = await apiFetch(`${API_BASE_URL}/users/me/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword,
      newPassword
    })
  });

  if (!response.ok) return throwApiError(response, 'Failed to change password');
  return response.json();
};

// --- Admin-only functions (ADMIN role required server-side) ---

// List all users, paginated (GET /users). Unlike getPublishedCourses, this
// requires auth + ADMIN — no public equivalent exists.
export const getUsers = async (page?: number, limit?: number): Promise<UserListResponse> => {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  const query = params.toString();
  const response = await apiFetch(`${API_BASE_URL}/users${query ? `?${query}` : ''}`);

  if (!response.ok) return throwApiError(response, 'Failed to load users');
  return response.json();
};

// Admin update of any user (PUT /users/:id) — may change role/level/totalPoints,
// unlike the self-service updateProfile above.
export const updateUserAsAdmin = async (id: string, dto: AdminUpdateUserInput): Promise<User> => {
  const response = await apiFetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!response.ok) return throwApiError(response, 'Failed to update user');
  return response.json();
};

// Delete a user (DELETE /users/:id -> 204 No Content). No body to parse.
export const deleteUser = async (id: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) return throwApiError(response, 'Failed to delete user');
};
