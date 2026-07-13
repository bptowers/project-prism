/**
 * Project Prism - Bounded-concurrency map
 *
 * Runs `worker` over every item with at most `limit` in flight at once,
 * preserving result order by index. Dependency-free (no p-limit) fixed-size
 * worker-pool: `limit` runner loops each pull the next index off a shared
 * counter until the list is exhausted.
 *
 * Replaces the old "all batches via Promise.all, 5-at-a-time within each"
 * scheme, where effective concurrency was 5 × batchCount (≈100 for 500
 * records) — bounded only by a racy per-provider rate limiter. Here the cap
 * is a single hard global limit.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const runner = async (): Promise<void> => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  };

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => runner()));
  return results;
}
