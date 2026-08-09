// A bounded worker pool for "map an async function over an array, but don't
// fire every call at once." ContextualSession needs one `getWord()` per word
// in a deck before it can decide which words are usable — a plain
// `Promise.all(words.map(getWord))` would burst as many concurrent requests
// as the deck has words (50-100+ for a large deck), which is bad practice
// regardless of whether the backend happens to rate-limit that route today.
//
// `fn` is responsible for its own error handling — a rejection that escapes
// `fn` propagates through this pool's `Promise.all` immediately (standard
// Promise.all semantics: the other in-flight workers are NOT cancelled, they
// keep running to completion, but nothing reads their results once the
// overall call has already rejected). Callers that need "one item failing
// must not lose the rest" — as ContextualSession does — must catch inside
// `fn` and return a sentinel (e.g. `null`) instead of letting it throw.
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current]);
    }
  };

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
};
