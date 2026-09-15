import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  getStudentOverview,
  getStudentDetail,
  setStudentActiveStatus,
  AdminStudentListRow,
  AdminStudentDetail,
} from './adminStudentService';

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const rowOf = (overrides: Partial<AdminStudentListRow> = {}): AdminStudentListRow => ({
  id: 'user-1',
  name: 'Tu',
  email: 'tu@example.com',
  avatarUrl: null,
  role: 'USER',
  level: 2,
  learningGoal: 'TOEIC_650',
  progressPercent: 57,
  completedLessons: 8,
  totalLessons: 14,
  averageTestScore: 78,
  completedTestCount: 5,
  isPro: false,
  proExpiresAt: null,
  isActive: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

const detailOf = (overrides: Partial<AdminStudentDetail> = {}): AdminStudentDetail => ({
  profile: {
    id: 'user-1',
    name: 'Tu',
    email: 'tu@example.com',
    avatarUrl: null,
    level: 2,
    learningGoal: 'TOEIC_650',
    createdAt: '2026-09-01T00:00:00.000Z',
    isActive: true,
    isPro: false,
    proExpiresAt: null,
  },
  progress: {
    progressPercent: null,
    completedLessons: 0,
    totalLessons: 0,
    hasRoadmap: false,
    averageTestScore: null,
    completedTestCount: 0,
    recentTests: [],
  },
  activity: {
    totalStudySeconds: 0,
    currentStreakDays: 0,
    speakingSessionsTotal: 0,
    speakingSessionsCompleted: 0,
  },
  billing: {
    plan: null,
    isPro: false,
    proExpiresAt: null,
    payments: [],
    paymentsTotal: 0,
  },
  ...overrides,
});

beforeEach(() => {
  localStorage.setItem('accessToken', 'token-abc');
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('getStudentOverview', () => {
  it('GETs /users/overview with page/limit/search query params', async () => {
    const body = { data: [rowOf()], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, body));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await getStudentOverview(2, 10, 'tu@example.com');

    expect(result).toEqual(body);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/users/overview');
    expect(String(url)).toContain('page=2');
    expect(String(url)).toContain('limit=10');
    expect(String(url)).toContain('search=tu%40example.com');
  });

  it('throws on a failed response (e.g. non-admin caller)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(403, { message: 'Access denied' })) as unknown as typeof fetch;

    await expect(getStudentOverview()).rejects.toThrow('Access denied');
  });
});

describe('getStudentDetail', () => {
  it('GETs /users/:id/overview and returns the parsed detail', async () => {
    const detail = detailOf();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, detail));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await getStudentDetail('user-1');

    expect(result).toEqual(detail);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/users/user-1/overview');
  });

  it('throws on a 404', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { message: 'User with ID x not found' })) as unknown as typeof fetch;

    await expect(getStudentDetail('missing')).rejects.toThrow('User with ID x not found');
  });
});

describe('setStudentActiveStatus', () => {
  it('PATCHes /users/:id/status with { isActive }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'user-1', isActive: false }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await setStudentActiveStatus('user-1', false);

    expect(result).toEqual({ id: 'user-1', isActive: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/users/user-1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ isActive: false });
  });

  it('throws on a 403 (e.g. an admin targeting their own account)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(403, { message: 'Admins cannot block their own account' }),
      ) as unknown as typeof fetch;

    await expect(setStudentActiveStatus('self-id', false)).rejects.toThrow(
      'Admins cannot block their own account',
    );
  });
});
