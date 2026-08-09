import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('never has more than `limit` calls in flight at once', async () => {
    // Items happen to equal index+1, which makes the round-robin-between-2-
    // workers order predictable: after item N resolves, item N+2 starts.
    const items = [1, 2, 3, 4, 5, 6];
    const pending = new Map<number, (value: string) => void>();
    let inFlight = 0;
    let maxInFlight = 0;

    const fn = (item: number) =>
      new Promise<string>((resolve) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        pending.set(item, (value) => {
          inFlight -= 1;
          resolve(value);
        });
      });

    const resultPromise = mapWithConcurrency(items, 2, fn);

    // Only the first 2 (the concurrency limit) should have started.
    expect(pending.size).toBe(2);
    expect(inFlight).toBe(2);

    for (const item of [1, 2, 3, 4]) {
      pending.get(item)!(`r${item}`);
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    expect(pending.size).toBe(6); // all 6 have started by now
    expect(maxInFlight).toBeLessThanOrEqual(2);

    pending.get(5)!('r5');
    pending.get(6)!('r6');

    expect(await resultPromise).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  });

  it('preserves input order regardless of which items resolve first', async () => {
    const pending = new Map<number, (value: string) => void>();
    const fn = (item: number) => new Promise<string>((resolve) => pending.set(item, resolve));

    const resultPromise = mapWithConcurrency([1, 2, 3], 3, fn);
    await Promise.resolve();

    // Resolve out of order — 3 first, then 1, then 2.
    pending.get(3)!('third');
    pending.get(1)!('first');
    pending.get(2)!('second');

    expect(await resultPromise).toEqual(['first', 'second', 'third']);
  });

  it('runs every item immediately when the limit is at least the item count', async () => {
    const calls: number[] = [];
    const fn = async (item: number) => {
      calls.push(item);
      return item * 2;
    };

    const results = await mapWithConcurrency([1, 2, 3], 10, fn);

    expect(calls.sort()).toEqual([1, 2, 3]);
    expect(results).toEqual([2, 4, 6]);
  });

  it('resolves to an empty array for an empty input, without calling fn', async () => {
    const fn = async (item: number) => item;
    expect(await mapWithConcurrency([], 4, fn)).toEqual([]);
  });

  it('propagates a rejection when fn itself does not catch it', async () => {
    const fn = async (item: number) => {
      if (item === 2) throw new Error('boom');
      return item;
    };

    await expect(mapWithConcurrency([1, 2, 3], 3, fn)).rejects.toThrow('boom');
  });
});
