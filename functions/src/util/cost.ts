/**
 * Project Prism - Approximate LLM cost estimation
 *
 * Rough USD estimate from token usage, for per-run cost observability only
 * (logged and written to executions/{id}) — never for billing. Prices are
 * approximate USD per 1M tokens and WILL drift; update when provider pricing
 * changes. Unrecognised models fall back to a generic rate.
 */
export interface TokenUsage {
  input: number;
  output: number;
}

const PRICES: Array<{ match: RegExp; inPer1M: number; outPer1M: number }> = [
  { match: /gemini-2\.5-flash/i, inPer1M: 0.30, outPer1M: 2.50 },
  { match: /gemini/i, inPer1M: 0.30, outPer1M: 2.50 },
  { match: /gpt-4o/i, inPer1M: 2.50, outPer1M: 10.0 },
  { match: /claude/i, inPer1M: 3.0, outPer1M: 15.0 },
];

const FALLBACK = { inPer1M: 1.0, outPer1M: 3.0 };

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICES.find((p) => p.match.test(model)) ?? FALLBACK;
  return (usage.input / 1_000_000) * price.inPer1M + (usage.output / 1_000_000) * price.outPer1M;
}
