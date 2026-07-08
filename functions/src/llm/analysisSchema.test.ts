import { isPortfolioCall, parseStrictAnalysis } from "./analysisSchema.js";
import { LLMValidationError } from "./provider.js";

function validPayload() {
  return {
    dealHealthScore: 62,
    velocityAssessment: "on-track",
    activityHealth: "active",
    stakeholderCoverage: "multi-threaded",
    competitorThreat: "present",
    riskSignals: { level: "medium", signals: ["Tier 2: single-threaded"], summary: "Moderate risk" },
    narrativeGap: { detected: false, description: "Aligned." },
    regionalIntelligence: { matchesRegionalPattern: true, deviation: "None detected." },
    competitors: { mentioned: ["JobLogic"], context: ["Named in notes"] },
    marketSignals: [],
    sentiment: { score: 0.4, label: "positive", basis: "Champion engaged" },
    recommendedAction: { priority: "P2", action: "Book exec alignment call", owner: "Manager", deadline: "48 hours" },
    confidence: 0.8,
  };
}

describe("parseStrictAnalysis", () => {
  it("parses a valid payload and preserves values", () => {
    const result = parseStrictAnalysis(validPayload(), "OPP-1", "Claude");
    expect(result.dealHealthScore).toBe(62);
    expect(result.riskSignals?.level).toBe("medium");
    expect(result.recommendedAction?.action).toBe("Book exec alignment call");
    expect(result.opportunityId).toBe("OPP-1");
  });

  it("clamps out-of-range numbers", () => {
    const p = { ...validPayload(), dealHealthScore: 140, confidence: 3 };
    const result = parseStrictAnalysis(p, "OPP-1", "Claude");
    expect(result.dealHealthScore).toBe(100);
    expect(result.confidence).toBe(1);
  });

  it("throws on missing dealHealthScore instead of defaulting to 50", () => {
    const p = validPayload() as Record<string, unknown>;
    delete p.dealHealthScore;
    expect(() => parseStrictAnalysis(p, "OPP-1", "Claude")).toThrow(LLMValidationError);
    expect(() => parseStrictAnalysis(p, "OPP-1", "Claude")).toThrow(/dealHealthScore/);
  });

  it("throws on invalid enum values instead of defaulting", () => {
    const p = { ...validPayload(), stakeholderCoverage: "many-people" };
    expect(() => parseStrictAnalysis(p, "OPP-1", "Gemini")).toThrow(/stakeholderCoverage/);
  });

  it("throws on empty recommended action", () => {
    const p = validPayload();
    p.recommendedAction.action = "  ";
    expect(() => parseStrictAnalysis(p, "OPP-1", "OpenAI")).toThrow(/recommendedAction.action/);
  });

  it("rejects non-objects", () => {
    expect(() => parseStrictAnalysis("{}", "OPP-1", "Claude")).toThrow(LLMValidationError);
    expect(() => parseStrictAnalysis(null, "OPP-1", "Claude")).toThrow(LLMValidationError);
  });

  it("collects multiple problems into one error message", () => {
    const p = { ...validPayload(), velocityAssessment: "warp-speed", activityHealth: "lukewarm" };
    expect(() => parseStrictAnalysis(p, "OPP-1", "Claude")).toThrow(/velocityAssessment.*activityHealth/s);
  });
});

describe("isPortfolioCall", () => {
  it("recognises all enrichment dummy-record ids, including portfolio-analysis", () => {
    for (const id of ["portfolio-analysis", "twenty-questions", "competitive-displacement", "delta-intelligence"]) {
      expect(isPortfolioCall(id)).toBe(true);
    }
    expect(isPortfolioCall("OPP-001")).toBe(false);
  });
});
