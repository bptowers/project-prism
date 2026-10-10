import { computePortfolioFacts, formatUsd } from "./portfolioFacts.js";
import { AggregatedReport, RiskDeal } from "../types.js";

function deal(overrides: Partial<RiskDeal> = {}): RiskDeal {
  return {
    opportunityId: "OPP-1",
    accountName: "Acme Corp",
    opportunityName: "Acme Platform Deal",
    stage: "Validation",
    amount: 1000,
    pipelineBasis: "mrr",
    dealHealthScore: 30,
    activityHealth: "cooling",
    velocityAssessment: "slowing",
    riskLevel: "high",
    signals: [],
    summary: "",
    lastUpdated: "2026-10-07T00:00:00Z",
    ...overrides,
  };
}

function report(regionDeals: Record<string, RiskDeal[]>, opts: { keepAllActive?: boolean } = {}): AggregatedReport {
  const keepAllActive = opts.keepAllActive ?? true;
  const regions: AggregatedReport["regions"] = {};
  let high = 0;
  let medium = 0;
  for (const [key, deals] of Object.entries(regionDeals)) {
    high += deals.filter((d) => d.riskLevel === "high").length;
    medium += deals.filter((d) => d.riskLevel === "medium").length;
    regions[key] = {
      region: key,
      totalOpportunities: deals.length,
      wins: 0,
      losses: 0,
      active: deals.length,
      winRate: 0,
      topWinThemes: [],
      topLossThemes: [],
      atRiskDeals: deals.filter((d) => d.riskLevel !== "low"),
      allActiveDeals: keepAllActive ? deals : [],
      competitorActivity: [],
      marketSignals: [],
      sentimentTrend: { average: 0, label: "neutral" },
      stageDistribution: [],
    };
  }
  return {
    reportId: "r",
    reportDate: "2026-10-07",
    period: "p",
    processingStartTime: "",
    processingEndTime: "",
    totalRecordsAnalyzed: 0,
    analysisProvider: "test",
    analysisModel: "test",
    regions,
    global: {
      totalOpportunities: 0,
      totalWins: 0,
      totalLosses: 0,
      totalActive: 0,
      globalWinRate: 0,
      topWinThemes: [],
      topLossThemes: [],
      topCompetitors: [],
      emergingMarketSignals: [],
      globalSentiment: { average: 0, label: "neutral" },
      highRiskCount: high,
      mediumRiskCount: medium,
    },
    dataQuality: { averageQualityScore: 0, totalPiiIssuesCaught: 0 },
  };
}

describe("formatUsd", () => {
  it("formats with thousands separators and two decimals", () => {
    expect(formatUsd(173769.85)).toBe("$173,769.85");
    expect(formatUsd(0)).toBe("$0.00");
  });
});

describe("computePortfolioFacts", () => {
  it("counts risk levels across every region's active deals", () => {
    const facts = computePortfolioFacts(report({
      uk: [deal({ riskLevel: "high" }), deal({ riskLevel: "medium" })],
      au: [deal({ riskLevel: "high" }), deal({ riskLevel: "low" }), deal({ riskLevel: "high" })],
    }));
    expect(facts.activeDeals).toBe(5);
    expect(facts.highRiskDeals).toBe(3);
    expect(facts.mediumRiskDeals).toBe(1);
    expect(facts.lowRiskDeals).toBe(1);
  });

  it("sums high-risk MRR and keeps Amount-only deals separate", () => {
    const facts = computePortfolioFacts(report({
      uk: [
        deal({ riskLevel: "high", amount: 1000.5, pipelineBasis: "mrr" }),
        deal({ riskLevel: "high", amount: 250, pipelineBasis: "mrr" }),
        deal({ riskLevel: "high", amount: 90000, pipelineBasis: "amount" }),
        deal({ riskLevel: "medium", amount: 5000, pipelineBasis: "mrr" }),
      ],
    }));
    expect(facts.highRiskMrr).toBeCloseTo(1250.5);
    expect(facts.highRiskAmountOnlyDeals).toBe(1);
    expect(facts.highRiskAmountOnlyValue).toBe(90000);
    expect(facts.totalAtRiskDisplay).toBe("$1,250.50 MRR (+1 HIGH-risk deal with contract Amount only, no MRR: $90,000.00)");
  });

  it("sums stalled MRR from the velocity assessment", () => {
    const facts = computePortfolioFacts(report({
      uk: [
        deal({ riskLevel: "high", velocityAssessment: "stalled", amount: 400 }),
        deal({ riskLevel: "low", velocityAssessment: "stalled", amount: 100 }),
        deal({ riskLevel: "high", velocityAssessment: "slowing", amount: 999 }),
      ],
    }));
    expect(facts.stalledDeals).toBe(2);
    expect(facts.stalledMrr).toBe(500);
    expect(facts.stalledRevenueDisplay).toBe("$500.00 MRR");
  });

  it("treats a deal with no amount as zero value but still counts it", () => {
    const facts = computePortfolioFacts(report({ uk: [deal({ amount: undefined })] }));
    expect(facts.highRiskDeals).toBe(1);
    expect(facts.highRiskMrr).toBe(0);
  });

  it("falls back to the global counts when per-deal lists were trimmed away", () => {
    const facts = computePortfolioFacts(report(
      { uk: [deal({ riskLevel: "high" }), deal({ riskLevel: "medium" })] },
      { keepAllActive: false }
    ));
    expect(facts.highRiskDeals).toBe(1);
    expect(facts.mediumRiskDeals).toBe(1);
    expect(facts.activeDeals).toBeNull();
    expect(facts.highRiskMrr).toBeNull();
    expect(facts.totalAtRiskDisplay).toBe("Not available in source data.");
  });
});

describe("computePortfolioFacts breakdowns", () => {
  it("totals the whole pipeline, keeping Amount-only deals separate", () => {
    const facts = computePortfolioFacts(report({
      uk: [deal({ amount: 100 }), deal({ riskLevel: "low", amount: 50 })],
      au: [deal({ riskLevel: "medium", amount: 7000, pipelineBasis: "amount" })],
    }));
    expect(facts.totalPipelineMrr).toBe(150);
    expect(facts.totalPipelineDisplay).toBe("$150.00 MRR (+1 deal with contract Amount only, no MRR: $7,000.00)");
  });

  it("breaks risk counts and MRR down by region", () => {
    const facts = computePortfolioFacts(report({
      uk: [deal({ amount: 100 }), deal({ riskLevel: "low", amount: 50 })],
      au: [deal({ amount: 10 }), deal({ amount: 20 }), deal({ riskLevel: "medium", amount: 5 })],
    }));
    expect(facts.byRegion).toEqual([
      { region: "au", activeDeals: 3, highRiskDeals: 2, mediumRiskDeals: 1, lowRiskDeals: 0, highRiskMrr: "$30.00 MRR", pipelineMrr: "$35.00 MRR", weightedPipelineMrr: "$0.00 MRR" },
      { region: "uk", activeDeals: 2, highRiskDeals: 1, mediumRiskDeals: 0, lowRiskDeals: 1, highRiskMrr: "$100.00 MRR", pipelineMrr: "$150.00 MRR", weightedPipelineMrr: "$0.00 MRR" },
    ]);
  });

  it("breaks risk counts down by stage, busiest stage first", () => {
    const facts = computePortfolioFacts(report({
      uk: [
        deal({ stage: "Discovery", amount: 1 }),
        deal({ stage: "Solution Review & Quote", amount: 10 }),
        deal({ stage: "Solution Review & Quote", riskLevel: "low", amount: 20 }),
      ],
      au: [deal({ stage: "Solution Review & Quote", amount: 30 })],
    }));
    expect(facts.byStage).toEqual([
      { stage: "Solution Review & Quote", activeDeals: 3, highRiskDeals: 2, highRiskMrr: "$40.00 MRR" },
      { stage: "Discovery", activeDeals: 1, highRiskDeals: 1, highRiskMrr: "$1.00 MRR" },
    ]);
  });

  it("has no breakdowns when the per-deal lists were trimmed away", () => {
    const facts = computePortfolioFacts(report({ uk: [deal()] }, { keepAllActive: false }));
    expect(facts.byRegion).toEqual([]);
    expect(facts.byStage).toEqual([]);
    expect(facts.totalPipelineDisplay).toBe("Not available in source data.");
  });
});

describe("computePortfolioFacts rep breakdown", () => {
  it("counts deals per rep, most HIGH-risk first, with unassigned deals grouped", () => {
    const facts = computePortfolioFacts(report({
      uk: [
        deal({ salesRep: "Jo", amount: 10 }),
        deal({ salesRep: "Jo", riskLevel: "low", amount: 5 }),
        deal({ salesRep: "Sam", amount: 1 }),
        deal({ salesRep: "Sam", amount: 2 }),
        deal({ salesRep: undefined, riskLevel: "medium", amount: 3 }),
      ],
    }));
    expect(facts.byRep).toEqual([
      { rep: "Sam", activeDeals: 2, highRiskDeals: 2, highRiskMrr: "$3.00 MRR" },
      { rep: "Jo", activeDeals: 2, highRiskDeals: 1, highRiskMrr: "$10.00 MRR" },
      { rep: "Unassigned", activeDeals: 1, highRiskDeals: 0, highRiskMrr: "$0.00 MRR" },
    ]);
  });
});

describe("computePortfolioFacts forecast views", () => {
  it("weights MRR by probability and strips dark/dormant deals for the ghost-stripped view", () => {
    const facts = computePortfolioFacts(report({
      uk: [
        deal({ amount: 1000, probability: 50, activityHealth: "active" }),
        deal({ amount: 400, probability: 25, activityHealth: "dark" }),
        deal({ amount: 200, probability: 100, activityHealth: "dormant" }),
        deal({ amount: 999, probability: undefined }),
        deal({ amount: 5000, probability: 50, pipelineBasis: "amount" }),
      ],
    }));
    expect(facts.weightedPipelineMrr).toBe("$800.00 MRR");
    expect(facts.ghostStrippedWeightedMrr).toBe("$500.00 MRR");
    expect(facts.dealsWithoutProbability).toBe(1);
    expect(facts.byRegion[0].weightedPipelineMrr).toBe("$800.00 MRR");
  });
});

describe("computePortfolioFacts on a stored report", () => {
  it("returns the facts stored on the report once the deal lists are trimmed", () => {
    const full = report({ uk: [deal({ amount: 100 })] });
    const stored = computePortfolioFacts(full);
    const trimmed = report({ uk: [deal({ amount: 100 })] }, { keepAllActive: false });
    trimmed.portfolioFacts = stored;
    expect(computePortfolioFacts(trimmed)).toEqual(stored);
  });
});
