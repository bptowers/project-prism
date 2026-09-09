/**
 * Enrichment payloads (Phases 3-5) come back as free-form JSON from the LLM.
 * On 2026-09-09 Gemini returned prose strings ("Not available in source data…")
 * where the schema calls for arrays; the dashboard called .map on a string and
 * the whole page went blank. These tests pin the shape contract the frontend
 * relies on: every array-typed field is an array, every map-typed field is a
 * plain object, and prose in the wrong slot is dropped, not stored.
 */
import {
  normalizeCompetitiveDisplacement,
  normalizeDeltaIntelligence,
  normalizeTwentyQuestions,
} from "./enrichmentSchema.js";

describe("normalizeCompetitiveDisplacement", () => {
  it("replaces prose strings in array slots with empty arrays", () => {
    const out = normalizeCompetitiveDisplacement({
      winMechanisms: { UK: { primaryCompetitor: "JobLogic" } },
      lossMechanisms: "Not available in source data.",
      regionalArbitrage: "Not available in source data.",
      rewarmOpportunities: "Not available in source data.",
    });
    expect(out.lossMechanisms).toEqual([]);
    expect(out.regionalArbitrage).toEqual([]);
    expect(out.rewarmOpportunities).toEqual([]);
    expect(out.winMechanisms).toEqual({ UK: { primaryCompetitor: "JobLogic" } });
  });

  it("keeps well-formed arrays and objects untouched", () => {
    const input = {
      winMechanisms: { NA: { primaryCompetitor: "ServiceTitan" } },
      lossMechanisms: [{ region: "NA", competitor: "ServiceTitan" }],
      regionalArbitrage: [],
      whyHaventTheyBought: { silentLossPattern: "x", urgencyGap: "y", missingNarrative: "z" },
      rewarmOpportunities: [{ lossReason: "Timing", dealCount: 3 }],
    };
    expect(normalizeCompetitiveDisplacement(input)).toEqual(input);
  });

  it("drops non-object values from map slots", () => {
    const out = normalizeCompetitiveDisplacement({
      winMechanisms: "No wins in source data.",
      whyHaventTheyBought: "Not available.",
    });
    expect(out.winMechanisms).toBeUndefined();
    expect(out.whyHaventTheyBought).toBeUndefined();
  });

  it("filters non-object entries out of array slots", () => {
    const out = normalizeCompetitiveDisplacement({
      lossMechanisms: [{ region: "UK" }, "stray prose", null, 42],
    });
    expect(out.lossMechanisms).toEqual([{ region: "UK" }]);
  });
});

describe("normalizeDeltaIntelligence", () => {
  it("coerces array slots at every nesting level", () => {
    const out = normalizeDeltaIntelligence({
      regionalTrajectory: "No regional data.",
      earlyWarnings: "None.",
      significantDealChanges: { improved: "None", deteriorated: [{ deal: "A" }] },
      competitiveMomentumShift: { gaining: "None", losing: [], newThreats: "None" },
    });
    expect(out.regionalTrajectory).toEqual([]);
    expect(out.earlyWarnings).toEqual([]);
    expect(out.significantDealChanges).toEqual({ improved: [], deteriorated: [{ deal: "A" }] });
    expect(out.competitiveMomentumShift).toEqual({ gaining: [], losing: [], newThreats: [] });
  });

  it("drops prose from map slots", () => {
    const out = normalizeDeltaIntelligence({
      pipelineTrajectory: "Unavailable.",
      forecastDrift: "Unavailable.",
      significantDealChanges: "Unavailable.",
    });
    expect(out.pipelineTrajectory).toBeUndefined();
    expect(out.forecastDrift).toBeUndefined();
    expect(out.significantDealChanges).toBeUndefined();
  });
});

describe("normalizeTwentyQuestions", () => {
  it("coerces every row-array slot on every question", () => {
    const out = normalizeTwentyQuestions({
      generatedAt: "2026-09-09",
      question1: { label: "Silent", answer: "…", silent7Days: "None", silent14Days: [{ name: "A" }] },
      question2: { label: "Slip", answer: "…", deals: "No slippage detected." },
      question7: { label: "Gap", answer: "…", optimismBias: [], sandbagging: "None" },
    });
    expect(out.question1).toEqual({ label: "Silent", answer: "…", silent7Days: [], silent14Days: [{ name: "A" }] });
    expect(out.question2).toEqual({ label: "Slip", answer: "…", deals: [] });
    expect(out.question7).toEqual({ label: "Gap", answer: "…", optimismBias: [], sandbagging: [] });
    expect(out.generatedAt).toBe("2026-09-09");
  });

  it("drops a question whose value is not an object", () => {
    const out = normalizeTwentyQuestions({ question3: "Not enough data." });
    expect(out.question3).toBeUndefined();
  });
});
