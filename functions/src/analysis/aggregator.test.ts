import { Aggregator, getEnrichmentJson } from "./aggregator.js";
import { AggregatedReport, OpportunityRecord, RiskDeal } from "../types.js";
import { ILLMProvider, LLMAnalysisOutput } from "../llm/provider.js";

function riskDeal(overrides: Partial<RiskDeal> = {}): RiskDeal {
  return {
    opportunityId: "OPP-1",
    accountName: "Acme Corp",
    opportunityName: "Acme Platform Deal",
    stage: "Validation",
    salesRep: "James Mitchell",
    amount: 1200,
    probability: 60,
    dealHealthScore: 55,
    activityHealth: "cooling",
    velocityAssessment: "slowing",
    daysSinceLastActivity: 9,
    riskLevel: "medium",
    signals: ["Tier 2: single-threaded", "Tier 3: next step absent"],
    summary: "Moderate risk",
    lastUpdated: "2026-07-08T00:00:00Z",
    ...overrides,
  };
}

function minimalReport(): AggregatedReport {
  const region = {
    region: "uk",
    totalOpportunities: 1,
    wins: 0,
    losses: 0,
    active: 1,
    winRate: 0,
    topWinThemes: [],
    topLossThemes: [],
    atRiskDeals: [riskDeal()],
    allActiveDeals: [riskDeal()],
    competitorActivity: [],
    marketSignals: [],
    sentimentTrend: { average: 0, label: "neutral" as const },
    stageDistribution: [],
  };
  return {
    reportId: "report_test",
    reportDate: "2026-07-08",
    period: "Week 28, July 2026",
    processingStartTime: "2026-07-08T00:00:00Z",
    processingEndTime: "2026-07-08T00:01:00Z",
    totalRecordsAnalyzed: 1,
    analysisProvider: "test",
    analysisModel: "test",
    regions: { uk: region },
    global: {
      totalOpportunities: 1,
      totalWins: 0,
      totalLosses: 0,
      totalActive: 1,
      globalWinRate: 0,
      topWinThemes: [],
      topLossThemes: [],
      topCompetitors: [],
      emergingMarketSignals: [],
      globalSentiment: { average: 0, label: "neutral" as const },
      highRiskCount: 0,
      mediumRiskCount: 1,
    },
    dataQuality: { averageQualityScore: 85, totalPiiIssuesCaught: 0 },
  };
}

// buildGroundedSummary is private; access via bracket lookup (runtime-visible).
// Regression test for the self-recursion bug (RangeError: Maximum call stack
// size exceeded) that silently killed all four enrichment phases in prod.
const grounded = (report: AggregatedReport): string =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Aggregator as any).buildGroundedSummary(report);

describe("Aggregator.buildGroundedSummary", () => {
  it("returns without recursing and contains the report summary", () => {
    const out = grounded(minimalReport());
    expect(typeof out).toBe("string");
    expect(out).toContain('"reportDate":"2026-07-08"');
  });

  it("includes the per-deal table wrapped in user-data markers", () => {
    const out = grounded(minimalReport());
    expect(out).toContain("PER-DEAL DATA");
    expect(out).toContain("[BEGIN_USER_DATA");
    expect(out).toContain("[END_USER_DATA]");
    expect(out).toContain('"deal":"Acme Platform Deal"');
    expect(out).toContain('"rep":"James Mitchell"');
    expect(out).toContain('"mrr":1200');
    expect(out).toContain('"daysSinceLastActivity":9');
  });

  it("handles a report with no deals (summary only, no markers)", () => {
    const report = minimalReport();
    report.regions.uk.allActiveDeals = [];
    report.regions.uk.atRiskDeals = [];
    const out = grounded(report);
    expect(out).toContain('"reportDate"');
    expect(out).not.toContain("[BEGIN_USER_DATA");
  });
});

const dummyRecord: OpportunityRecord = {
  opportunityId: "portfolio-analysis",
  accountName: "Portfolio",
  opportunityName: "Portfolio Aggregation",
  stage: "N/A",
  winLossStatus: "active",
  notes: "prompt",
  region: "Global",
};

function fakeProvider(responses: Array<Partial<LLMAnalysisOutput>>): ILLMProvider {
  let call = 0;
  return {
    analyze: jest.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)];
      call++;
      return [
        {
          analysis: {},
          rawResponse: r.rawResponse ?? "",
          processingTimeMs: 0,
          success: r.success ?? true,
          error: r.error,
        },
      ];
    }),
    validateConnection: jest.fn(),
    getProviderInfo: jest.fn(() => ({ name: "fake", model: "fake", version: "1.0.0" })),
  };
}

describe("getEnrichmentJson", () => {
  it("returns parsed JSON on first success, without retrying", async () => {
    const provider = fakeProvider([{ rawResponse: '{"ok":true}' }]);
    const result = await getEnrichmentJson<{ ok: boolean }>(provider, dummyRecord, "prompt", "Test Phase");
    expect(result.ok).toBe(true);
    expect(provider.analyze).toHaveBeenCalledTimes(1);
  });

  it("retries once after a non-JSON response, then succeeds", async () => {
    // Regression: production saw Phase 2/3 return zero JSON braces at all
    // on the first attempt, twice in a row across separate runs.
    const provider = fakeProvider([
      { rawResponse: "I'm sorry, I cannot provide that analysis." },
      { rawResponse: '{"ok":true}' },
    ]);
    const result = await getEnrichmentJson<{ ok: boolean }>(provider, dummyRecord, "prompt", "Test Phase");
    expect(result.ok).toBe(true);
    expect(provider.analyze).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    const provider = fakeProvider([{ rawResponse: "no json here" }]);
    await expect(
      getEnrichmentJson(provider, dummyRecord, "prompt", "Test Phase")
    ).rejects.toThrow(/No JSON object found/);
    expect(provider.analyze).toHaveBeenCalledTimes(2);
  });

  it("retries on an unsuccessful provider result, not just parse failures", async () => {
    const provider = fakeProvider([
      { success: false, error: "rate limited" },
      { rawResponse: '{"ok":true}' },
    ]);
    const result = await getEnrichmentJson<{ ok: boolean }>(provider, dummyRecord, "prompt", "Test Phase");
    expect(result.ok).toBe(true);
  });
});
