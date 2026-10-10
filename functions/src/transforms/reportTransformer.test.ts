import { ReportTransformer } from "./reportTransformer";
import { AggregatedReport, RegionReport, RiskDeal } from "../types";

function riskDeal(overrides: Partial<RiskDeal> = {}): RiskDeal {
  return {
    opportunityId: "OPP-1",
    accountName: "Acme",
    opportunityName: "Acme Deal",
    stage: "Validation",
    amount: 1000,
    dealHealthScore: 55,
    activityHealth: "cooling",
    velocityAssessment: "slowing",
    daysSinceLastActivity: 9,
    riskLevel: "medium",
    signals: [],
    summary: "Moderate",
    lastUpdated: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

function regionReport(region: string, overrides: Partial<RegionReport> = {}): RegionReport {
  const deals = overrides.allActiveDeals ?? [riskDeal({ opportunityId: `${region}-1` })];
  return {
    region,
    totalOpportunities: deals.length,
    wins: 0,
    losses: 0,
    active: deals.length,
    winRate: 0,
    topWinThemes: [],
    topLossThemes: [],
    atRiskDeals: deals.filter((d) => d.riskLevel !== "low"),
    allActiveDeals: deals,
    competitorActivity: [],
    marketSignals: [],
    sentimentTrend: { average: 0, label: "neutral" },
    stageDistribution: [],
    ...overrides,
  };
}

function report(regions: Record<string, RegionReport>): AggregatedReport {
  const all = Object.values(regions);
  return {
    reportId: "r",
    reportDate: "2026-09-10",
    period: "Week 37",
    processingStartTime: "",
    processingEndTime: "",
    totalRecordsAnalyzed: all.reduce((n, r) => n + r.totalOpportunities, 0),
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
      highRiskCount: 0,
      mediumRiskCount: 0,
    },
    dataQuality: { averageQualityScore: 100, totalPiiIssuesCaught: 0 },
  };
}

describe("ReportTransformer region contract", () => {
  it("stamps every per-deal record with the normalised region key (na|uk|au)", () => {
    const out = ReportTransformer.transform(
      report({
        NAMER: regionReport("NAMER"),
        UK: regionReport("UK"),
        ANZ: regionReport("ANZ"),
      })
    );
    expect(Object.keys(out).sort()).toEqual(["all", "au", "na", "uk"]);
    expect(out.all.risks.map((d) => d.region).sort()).toEqual(["au", "na", "uk"]);
    expect(out.na.risks[0].region).toBe("na");
    expect(out.uk.risks[0].region).toBe("uk");
    expect(out.au.risks[0].region).toBe("au");
  });

  it("lowercases an unrecognised region rather than dropping it", () => {
    const out = ReportTransformer.transform(report({ Unknown: regionReport("Unknown") }));
    expect(out.unknown).toBeDefined();
    expect(out.unknown.risks[0].region).toBe("unknown");
    expect(out.all.risks[0].region).toBe("unknown");
  });
});

describe("ReportTransformer AU/NZ merge", () => {
  const au = regionReport("au", {
    allActiveDeals: [riskDeal({ opportunityId: "AU-1" }), riskDeal({ opportunityId: "AU-2", riskLevel: "high" })],
    atRiskDeals: [riskDeal({ opportunityId: "AU-1" }), riskDeal({ opportunityId: "AU-2", riskLevel: "high" })],
    totalOpportunities: 4,
    wins: 1,
    losses: 1,
    active: 2,
    winRate: 0.5,
    competitorActivity: [{ competitor: "JobLogic", mentionCount: 2, contexts: ["Incumbent"], regions: ["au"] }],
    marketSignals: ["Labour shortage"],
    sentimentTrend: { average: 0.4, label: "positive" },
    stageDistribution: [{ stage: "Validation", count: 2, revenue: 2000 }],
  });
  const nz = regionReport("nz", {
    allActiveDeals: [riskDeal({ opportunityId: "NZ-1", riskLevel: "low" })],
    atRiskDeals: [],
    totalOpportunities: 2,
    wins: 0,
    losses: 1,
    active: 1,
    winRate: 0,
    competitorActivity: [
      { competitor: "JobLogic", mentionCount: 1, contexts: ["Price"], regions: ["nz"] },
      { competitor: "Tradify", mentionCount: 3, contexts: [], regions: ["nz"] },
    ],
    marketSignals: ["Labour shortage", "Compliance push"],
    sentimentTrend: { average: -0.4, label: "negative" },
    stageDistribution: [{ stage: "Validation", count: 1, revenue: 1000 }, { stage: "Commit", count: 0, revenue: 0 }],
  });

  it("produces one au slice whose totals are the sum of both regions", () => {
    const out = ReportTransformer.transform(report({ au, nz }));
    expect(Object.keys(out).sort()).toEqual(["all", "au"]);
    expect(out.au.stats.pipeline.value).toBe("6 opps");
    expect(out.au.stats.pipeline.sub).toBe("1W / 2L / 3A");
    expect(out.au.risks.map((d) => d.opportunityId).sort()).toEqual(["AU-1", "AU-2", "NZ-1"]);
    expect(out.au.risks.every((d) => d.region === "au")).toBe(true);
    expect(out.au.stats.atRisk.value).toBe("2");
    expect(out.au.stats.atRisk.sub).toBe("1 high risk");
  });

  it("recomputes win rate weighted by deals, not averaged", () => {
    const out = ReportTransformer.transform(report({ au, nz }));
    // 1 win of 3 decided deals = 33%, not (50% + 0%) / 2 = 25%
    expect(out.au.stats.winRate.value).toBe("33%");
    expect(out.au.stats.winRate.sub).toBe("1 wins of 3");
  });

  it("merges competitors by name, signals uniquely, and funnel stages by stage", () => {
    const out = ReportTransformer.transform(report({ au, nz }));
    const jobLogic = out.au.competitors.find((c) => c.name === "JobLogic");
    expect(jobLogic?.losses).toBe(3); // mentionCount summed
    expect(out.au.competitors.map((c) => c.name).sort()).toEqual(["JobLogic", "Tradify"]);
    expect(out.au.signals.map((s) => s.text)).toEqual(["Labour shortage", "Compliance push"]);
    expect(out.au.funnel.find((f) => f.stage === "Validation")?.count).toBe(3);
    expect(out.au.funnel.find((f) => f.stage === "Validation")?.revenue).toBe("$3K");
  });

  it("mergeRegionReports weights sentiment by opportunity count", () => {
    const merged = ReportTransformer.mergeRegionReports("au", [au, nz]);
    // (0.4*4 + -0.4*2) / 6 = 0.13 → neutral
    expect(merged.sentimentTrend).toEqual({ average: 0.13, label: "neutral" });
    expect(merged.region).toBe("au");
  });

  it("leaves a region that maps to a unique key untouched", () => {
    const uk = regionReport("UK", { wins: 3, losses: 1, winRate: 0.75, totalOpportunities: 5 });
    const out = ReportTransformer.transform(report({ UK: uk, au }));
    expect(out.uk.stats.winRate.value).toBe("75%");
    expect(out.uk.stats.pipeline.value).toBe("5 opps");
  });
});

describe("ReportTransformer pipeline value basis", () => {
  it("carries pipelineBasis through to the frontend deal record", () => {
    const out = ReportTransformer.transform(
      report({
        UK: regionReport("UK", {
          allActiveDeals: [
            riskDeal({ opportunityId: "M", amount: 1500, pipelineBasis: "mrr" }),
            riskDeal({ opportunityId: "A", amount: 18000, pipelineBasis: "amount" }),
          ],
        }),
      })
    );
    const byId = Object.fromEntries(out.uk.risks.map((d) => [d.opportunityId, d]));
    expect(byId.M).toMatchObject({ pipelineValue: 1500, pipelineBasis: "mrr" });
    expect(byId.A).toMatchObject({ pipelineValue: 18000, pipelineBasis: "amount" });
  });

  it("leaves pipelineBasis undefined for legacy deals that never recorded it", () => {
    const out = ReportTransformer.transform(report({ UK: regionReport("UK") }));
    expect(out.uk.risks[0].pipelineBasis).toBeUndefined();
  });
});

describe("ReportTransformer.mergeRegionReports themes and ordering", () => {
  const theme = (t: string, count: number) => ({ theme: t, count, examples: [`${t}-ex`], percentage: 0 });

  it("recomputes win-theme % over wins and loss-theme % over losses, like the aggregator", () => {
    const a = regionReport("au", {
      totalOpportunities: 10, wins: 4, losses: 2, active: 4,
      topWinThemes: [theme("Champion", 2)],
      topLossThemes: [theme("Price", 1)],
    });
    const b = regionReport("nz", {
      totalOpportunities: 10, wins: 1, losses: 3, active: 6,
      topWinThemes: [theme("Champion", 1)],
      topLossThemes: [theme("Price", 2), theme("Timing", 1)],
    });
    const merged = ReportTransformer.mergeRegionReports("au", [a, b]);
    // 3 of 5 wins = 60%, not 3 of 20 opportunities = 15%
    expect(merged.topWinThemes).toEqual([{ theme: "Champion", count: 3, examples: ["Champion-ex"], percentage: 60 }]);
    // 3 of 5 losses = 60%; 1 of 5 = 20%
    expect(merged.topLossThemes.map((t) => [t.theme, t.percentage])).toEqual([["Price", 60], ["Timing", 20]]);
  });

  it("keeps the aggregator's 8-theme limit after merging", () => {
    const a = regionReport("au", { wins: 20, topWinThemes: Array.from({ length: 6 }, (_, i) => theme(`A${i}`, 6 - i)) });
    const b = regionReport("nz", { wins: 20, topWinThemes: Array.from({ length: 6 }, (_, i) => theme(`B${i}`, 6 - i)) });
    const merged = ReportTransformer.mergeRegionReports("au", [a, b]);
    expect(merged.topWinThemes).toHaveLength(8);
    expect(merged.topWinThemes[0].count).toBe(6);
  });

  it("re-sorts merged at-risk deals high-first", () => {
    const a = regionReport("au", { atRiskDeals: [riskDeal({ opportunityId: "AU-med", riskLevel: "medium" })] });
    const b = regionReport("nz", { atRiskDeals: [riskDeal({ opportunityId: "NZ-high", riskLevel: "high" })] });
    const merged = ReportTransformer.mergeRegionReports("au", [a, b]);
    expect(merged.atRiskDeals.map((d) => d.opportunityId)).toEqual(["NZ-high", "AU-med"]);
  });
});
