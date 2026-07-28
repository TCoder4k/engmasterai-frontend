import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getLessonQuiz,
  submitLessonQuiz,
  getManageQuiz,
  isQuizIdempotencyConflict,
  QUIZ_IDEMPOTENCY_CONFLICT,
} from './quizService';
import { ApiError } from './apiError';

// Sprint 06B — thin fetch wrappers, tested the way the codebase already
// tests this layer elsewhere (services/learningService has no dedicated
// spec of its own; apiError.test.ts covers throwApiError generically). This
// file exists to pin the one thing specific to quizService: the
// QUIZ_IDEMPOTENCY_CONFLICT code surfaces as a distinguishable ApiError,
// not just a bare failed request.

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('getLessonQuiz', () => {
  it('returns the parsed quiz on success', async () => {
    const quiz = { quiz: { taskId: 't1', passingScorePercent: 70, questions: [] }, progress: { attemptsCount: 0, bestScorePercent: null, passed: false, lastDurationSeconds: null } };
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, quiz)) as unknown as typeof fetch;

    const result = await getLessonQuiz('lesson-1');
    expect(result).toEqual(quiz);
  });

  it('throws an ApiError with the backend message on 404', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { message: 'Quiz for lesson lesson-1 not found' })) as unknown as typeof fetch;

    await expect(getLessonQuiz('lesson-1')).rejects.toMatchObject({
      message: 'Quiz for lesson lesson-1 not found',
      status: 404,
    });
  });
});

describe('submitLessonQuiz — idempotency conflict surfaces as a typed, distinguishable error', () => {
  it('is recognised by isQuizIdempotencyConflict', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(409, {
        statusCode: 409,
        code: QUIZ_IDEMPOTENCY_CONFLICT,
        message: 'This clientAttemptId was already used for a different set of answers. Retry with a new id.',
      }),
    ) as unknown as typeof fetch;

    try {
      await submitLessonQuiz('lesson-1', { clientAttemptId: 'a1', answers: [] });
      throw new Error('expected submitLessonQuiz to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(isQuizIdempotencyConflict(err)).toBe(true);
    }
  });

  it('a plain network/validation failure is not mistaken for the idempotency conflict', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(400, { message: 'Bad request' })) as unknown as typeof fetch;

    try {
      await submitLessonQuiz('lesson-1', { clientAttemptId: 'a1', answers: [] });
      throw new Error('expected submitLessonQuiz to reject');
    } catch (err) {
      expect(isQuizIdempotencyConflict(err)).toBe(false);
    }
  });
});

describe('getManageQuiz', () => {
  it('surfaces a 403 for a non-admin the same way any other admin endpoint does', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, { message: 'Forbidden resource' })) as unknown as typeof fetch;

    await expect(getManageQuiz('lesson-1')).rejects.toMatchObject({ status: 403 });
  });
});
