import { Aggregator, getEnrichmentJson } from "./aggregator.js";
import { AggregatedReport, OpportunityAnalysis, RiskDeal } from "../types.js";
import { ILLMProvider, LLMCompletionOutput } from "../llm/provider.js";

function riskDeal(overrides: Partial<RiskDeal> = {}): RiskDeal {
  return {
    opportunityId: "OPP-1",
    accountName: "Acme Corp",
    opportunityName: "Acme Platform Deal",
    stage: "Validation",
    salesRep: "James Mitchell",
    amount: 1200,
    pipelineBasis: "mrr",
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
    expect(out).toContain('"pipelineValue":1200');
    expect(out).toContain('"basis":"mrr"');
    expect(out).not.toContain('"mrr":');
    expect(out).toMatch(/pipelineValue is Expected MRR when basis is "mrr"/);
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

// getEnrichmentJson drives portfolio enrichment via provider.complete().
// Each fake "response" is either the text a complete() call returns, or an
// Error to throw for that attempt.
function fakeProvider(responses: Array<string | Error>): ILLMProvider {
  let call = 0;
  return {
    analyze: jest.fn(async () => []),
    complete: jest.fn(async (): Promise<LLMCompletionOutput> => {
      const r = responses[Math.min(call, responses.length - 1)];
      call++;
      if (r instanceof Error) throw r;
      return { text: r, tokensUsed: { input: 10, output: 20 } };
    }),
    validateConnection: jest.fn(),
    getProviderInfo: jest.fn(() => ({ name: "fake", model: "fake", version: "1.0.0" })),
  };
}

describe("getEnrichmentJson", () => {
  it("returns parsed JSON on first success, without retrying", async () => {
    const provider = fakeProvider(['{"ok":true}']);
    const result = await getEnrichmentJson<{ ok: boolean }>(provider, "prompt", "Test Phase");
    expect(result.ok).toBe(true);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("retries once after a non-JSON response, then succeeds", async () => {
    // Regression: production saw Phase 2/3 return zero JSON braces at all
    // on the first attempt, twice in a row across separate runs.
    const provider = fakeProvider([
      "I'm sorry, I cannot provide that analysis.",
      '{"ok":true}',
    ]);
    const result = await getEnrichmentJson<{ ok: boolean }>(provider, "prompt", "Test Phase");
    expect(result.ok).toBe(true);
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    const provider = fakeProvider(["no json here"]);
    await expect(
      getEnrichmentJson(provider, "prompt", "Test Phase")
    ).rejects.toThrow(/No JSON object found/);
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it("retries when the provider call itself throws, not just on parse failures", async () => {
    const provider = fakeProvider([
      new Error("rate limited"),
      '{"ok":true}',
    ]);
    const result = await getEnrichmentJson<{ ok: boolean }>(provider, "prompt", "Test Phase");
    expect(result.ok).toBe(true);
  });
});

// ── Enrichment phases must store normalised shapes ─────────────────────────
// Regression for the 2026-09-09 blank dashboard: Gemini returned prose strings
// in array slots and the raw payload was written to Firestore verbatim.
import { LLMProviderFactory } from "../llm/provider.js";
import { LLMConfig } from "../types.js";

const fakeConfig: LLMConfig = { provider: "gemini", model: "fake", apiKey: "x", temperature: 0, maxTokens: 10 };

describe("enrichment phases normalise LLM payload shapes before storing", () => {
  afterEach(() => jest.restoreAllMocks());

  it("Phase 4 coerces prose in array slots to empty arrays", async () => {
    jest.spyOn(LLMProviderFactory, "create").mockResolvedValue(
      fakeProvider([JSON.stringify({
        winMechanisms: { UK: { primaryCompetitor: "JobLogic" } },
        lossMechanisms: "Not available in source data.",
        regionalArbitrage: "Not available in source data.",
        rewarmOpportunities: "Not available in source data.",
      })])
    );
    const report = await Aggregator.enrichWithCompetitiveDisplacement(minimalReport(), fakeConfig);
    expect(report.competitiveDisplacement?.lossMechanisms).toEqual([]);
    expect(report.competitiveDisplacement?.regionalArbitrage).toEqual([]);
    expect(report.competitiveDisplacement?.rewarmOpportunities).toEqual([]);
    expect(report.competitiveDisplacement?.winMechanisms).toEqual({ UK: { primaryCompetitor: "JobLogic" } });
  });

  it("Phase 5 coerces nested array slots", async () => {
    jest.spyOn(LLMProviderFactory, "create").mockResolvedValue(
      fakeProvider([JSON.stringify({
        regionalTrajectory: "None.",
        earlyWarnings: "None.",
        significantDealChanges: { improved: "None", deteriorated: [] },
      })])
    );
    const report = await Aggregator.enrichWithDeltaIntelligence(minimalReport(), minimalReport(), fakeConfig);
    expect(report.deltaIntelligence?.regionalTrajectory).toEqual([]);
    expect(report.deltaIntelligence?.earlyWarnings).toEqual([]);
    expect(report.deltaIntelligence?.significantDealChanges).toEqual({ improved: [], deteriorated: [] });
  });

  it("Phase 3 coerces row arrays on each question", async () => {
    jest.spyOn(LLMProviderFactory, "create").mockResolvedValue(
      fakeProvider([JSON.stringify({
        question2: { label: "Slip", answer: "…", deals: "No slippage detected." },
      })])
    );
    const report = await Aggregator.enrichWithTwentyQuestions(minimalReport(), fakeConfig);
    expect(report.twentyQuestions?.question2).toEqual({ label: "Slip", answer: "…", deals: [] });
  });
});

describe("Aggregator.aggregate dataQuality", () => {
  it("records the PII issue count supplied by the pipeline", () => {
    const report = Aggregator.aggregate([], "2026-09-10T00:00:00Z", "test", "test-1", 88, 7);
    expect(report.dataQuality).toEqual({ averageQualityScore: 88, totalPiiIssuesCaught: 7 });
  });
});

describe("Aggregator.aggregate pipeline value basis", () => {
  function analysis(overrides: Partial<OpportunityAnalysis>): OpportunityAnalysis {
    return {
      opportunityId: "OPP-1",
      accountName: "Acme",
      opportunityName: "Acme Deal",
      region: "uk",
      stage: "Validation",
      winLossStatus: "active",
      analysisDate: "2026-09-10T00:00:00Z",
      dealHealthScore: 70,
      velocityAssessment: "on-track",
      activityHealth: "active",
      stakeholderCoverage: "multi-threaded",
      competitorThreat: "none",
      riskSignals: { level: "low", signals: [], summary: "" },
      narrativeGap: { detected: false, description: "" },
      regionalIntelligence: { matchesRegionalPattern: true, deviation: "" },
      competitors: { mentioned: [], context: [] },
      marketSignals: [],
      sentiment: { score: 0, label: "neutral" },
      recommendedAction: { priority: "P3", action: "Keep going", owner: "AE", deadline: "This week" },
      confidence: 0.8,
      processingTimeMs: 0,
      ...overrides,
    };
  }

  it("marks a deal with expected MRR as mrr-basis and uses MRR as its amount", () => {
    const report = Aggregator.aggregate(
      [analysis({ expectedMRR: 1500, amount: 18000 })],
      "2026-09-10T00:00:00Z", "test", "test-1", 100
    );
    const deal = report.regions.uk.allActiveDeals[0];
    expect(deal.amount).toBe(1500);
    expect(deal.pipelineBasis).toBe("mrr");
  });

  it("marks a deal with only a contract amount as amount-basis", () => {
    const report = Aggregator.aggregate(
      [analysis({ amount: 18000, dealHealthScore: 30, riskSignals: { level: "high", signals: [], summary: "" } })],
      "2026-09-10T00:00:00Z", "test", "test-1", 100
    );
    expect(report.regions.uk.allActiveDeals[0]).toMatchObject({ amount: 18000, pipelineBasis: "amount" });
    expect(report.regions.uk.atRiskDeals[0]).toMatchObject({ amount: 18000, pipelineBasis: "amount" });
  });
});
