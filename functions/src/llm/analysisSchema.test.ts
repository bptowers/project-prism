import { parseStrictAnalysis } from "./analysisSchema.js";
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
    // level is derived from the score (62 → low); the model's "medium" is kept as llmLevel
    expect(result.riskSignals?.level).toBe("low");
    expect(result.riskSignals?.llmLevel).toBe("medium");
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

describe("parseStrictAnalysis — risk level derived from dealHealthScore", () => {
  const withScore = (dealHealthScore: number, llmLevel = "medium") => ({
    ...validPayload(),
    dealHealthScore,
    riskSignals: { ...validPayload().riskSignals, level: llmLevel },
  });

  it.each([
    [0, "high"],
    [39, "high"],
    [40, "medium"],
    [59, "medium"],
    [60, "low"],
    [100, "low"],
  ])("score %i → level %s", (score, expected) => {
    const result = parseStrictAnalysis(withScore(score), "OPP-1", "Claude");
    expect(result.riskSignals?.level).toBe(expected);
  });

  it("derives level from the CLAMPED score", () => {
    const result = parseStrictAnalysis(withScore(140, "high"), "OPP-1", "Claude");
    expect(result.dealHealthScore).toBe(100);
    expect(result.riskSignals?.level).toBe("low");
  });

  it("overrides the model's level when it disagrees with the score", () => {
    const result = parseStrictAnalysis(withScore(65, "high"), "OPP-1", "Claude");
    expect(result.riskSignals?.level).toBe("low");
  });

  it("preserves the model's own level as llmLevel", () => {
    const result = parseStrictAnalysis(withScore(65, "high"), "OPP-1", "Claude");
    expect(result.riskSignals?.llmLevel).toBe("high");
  });

  it("still rejects an invalid model level", () => {
    expect(() => parseStrictAnalysis(withScore(65, "catastrophic"), "OPP-1", "Claude"))
      .toThrow(/riskSignals.level/);
  });
});
