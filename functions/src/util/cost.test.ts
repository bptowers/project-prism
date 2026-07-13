import { estimateCostUsd } from "./cost.js";

describe("estimateCostUsd", () => {
  it("prices gemini-2.5-flash by input+output tokens", () => {
    // 1M input @ $0.30 + 1M output @ $2.50 = $2.80
    expect(estimateCostUsd("gemini-2.5-flash", { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(2.8, 5);
  });

  it("scales linearly with token counts", () => {
    const one = estimateCostUsd("gemini-2.5-flash", { input: 100_000, output: 50_000 });
    const two = estimateCostUsd("gemini-2.5-flash", { input: 200_000, output: 100_000 });
    expect(two).toBeCloseTo(one * 2, 6);
  });

  it("returns 0 for zero usage", () => {
    expect(estimateCostUsd("gemini-2.5-flash", { input: 0, output: 0 })).toBe(0);
  });

  it("applies a generic fallback rate for unknown models", () => {
    // fallback $1/1M in + $3/1M out
    expect(estimateCostUsd("some-unknown-model", { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(4.0, 5);
  });

  it("distinguishes providers (gpt-4o and claude priced higher than gemini)", () => {
    const usage = { input: 1_000_000, output: 1_000_000 };
    const gemini = estimateCostUsd("gemini-2.5-flash", usage);
    expect(estimateCostUsd("gpt-4o", usage)).toBeGreaterThan(gemini);
    expect(estimateCostUsd("claude-sonnet-4-6", usage)).toBeGreaterThan(gemini);
  });
});
