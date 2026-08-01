import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitPractice, getPractice } from './practiceService';
import * as gamificationService from './gamificationService';
import { GamificationResult } from './gamificationService';

// Sprint 10 QA — Advanced Practice awarded no XP, and this file is where the
// defect was.
//
// The server had been writing the 40-XP ledger row and returning the envelope
// all along; `submitPractice` was the ONE award-bearing wrapper that parsed the
// body and dropped `gamification` on the floor. Nothing downstream could
// notice, because every award site in this app publishes at the SERVICE
// boundary — AdvancedPracticeStage never touches `res.gamification` any more
// than QuizStage does, and both are right not to.
//
// So the test has to live here. A component test cannot see it: the stage's
// suite mocks this very module, which is exactly how the gap survived.

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const award = (
  overrides: Partial<GamificationResult> = {},
): GamificationResult => ({
  xpAwarded: 40,
  xp: { totalXp: 1280, level: 6, intoLevel: 280, toNextLevel: 70, percent: 80 },
  leveledUp: false,
  unlockedAchievements: [],
  ...overrides,
});

const submitBody = (gamification?: GamificationResult) => ({
  passed: true,
  correctCount: 2,
  totalCount: 2,
  scorePercent: 100,
  attemptsCount: 1,
  results: [],
  ...(gamification ? { gamification } : {}),
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('submitPractice', () => {
  it('ANNOUNCES the award the server reported', async () => {
    const publish = vi.spyOn(gamificationService, 'publishGamificationResult');
    const gamification = award();
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(201, submitBody(gamification)),
      ) as unknown as typeof fetch;

    const result = await submitPractice('lesson-1', {
      clientAttemptId: 'a1',
      answers: [],
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(gamification);
    // ...and the caller still gets the whole body. Publishing is a side
    // effect, not a replacement for returning the result.
    expect(result.passed).toBe(true);
  });

  it('publishes a replay envelope too, and lets the publisher filter it', async () => {
    // xpAwarded: 0 is a real, meaningful answer — the publisher drops it in one
    // place rather than at five call sites. Filtering it here as well would
    // just be a second rule to keep in step.
    const publish = vi.spyOn(gamificationService, 'publishGamificationResult');
    const replay = award({
      xpAwarded: 0,
      xp: {
        totalXp: 1240,
        level: 6,
        intoLevel: 240,
        toNextLevel: 110,
        percent: 68,
      },
    });
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(201, submitBody(replay)),
      ) as unknown as typeof fetch;

    await submitPractice('lesson-1', { clientAttemptId: 'a1', answers: [] });

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ xpAwarded: 0 }),
    );
  });

  it('does not fall over on a response carrying no envelope at all', async () => {
    const publish = vi.spyOn(gamificationService, 'publishGamificationResult');
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(201, submitBody()),
      ) as unknown as typeof fetch;

    await expect(
      submitPractice('lesson-1', { clientAttemptId: 'a1', answers: [] }),
    ).resolves.toMatchObject({ passed: true });
    expect(publish).toHaveBeenCalledWith(undefined);
  });

  it('announces NOTHING when the request fails', async () => {
    const publish = vi.spyOn(gamificationService, 'publishGamificationResult');
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(400, { message: 'Bad request' }),
      ) as unknown as typeof fetch;

    await expect(
      submitPractice('lesson-1', { clientAttemptId: 'a1', answers: [] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('getPractice', () => {
  it('announces nothing — a read earns no XP', async () => {
    const publish = vi.spyOn(gamificationService, 'publishGamificationResult');
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        availability: { state: 'available' },
        task: null,
        progress: {
          attemptsCount: 0,
          bestScorePercent: null,
          passed: false,
          lastDurationSeconds: null,
        },
        attempt: null,
      }),
    ) as unknown as typeof fetch;

    await getPractice('lesson-1');

    expect(publish).not.toHaveBeenCalled();
  });
});
