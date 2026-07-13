import { mapWithConcurrency } from "./concurrency.js";

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("mapWithConcurrency", () => {
  it("never exceeds the concurrency limit and completes all items", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 50 }, (_, i) => i);

    const results = await mapWithConcurrency(items, 8, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      inFlight--;
      return n * 2;
    });

    expect(maxInFlight).toBeLessThanOrEqual(8);
    expect(maxInFlight).toBeGreaterThan(1); // actually ran in parallel
    expect(results).toHaveLength(50);
  });

  it("preserves result order by index regardless of completion timing", async () => {
    const items = [40, 10, 30, 20, 0];
    // Earlier-listed items resolve later, so completion order != input order.
    const results = await mapWithConcurrency(items, 3, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return `${i}:${ms}`;
    });
    expect(results).toEqual(["0:40", "1:10", "2:30", "3:20", "4:0"]);
  });

  it("handles an empty list", async () => {
    const results = await mapWithConcurrency<number, number>([], 8, async (n) => n);
    expect(results).toEqual([]);
  });

  it("caps the pool at the item count when limit exceeds it", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency([1, 2], 100, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      inFlight--;
      return n;
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(results).toEqual([1, 2]);
  });

  it("propagates a worker rejection", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
  });
});
