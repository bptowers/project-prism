import { computeDealMetrics, daysBetween } from "./dealMetrics.js";
import { OpportunityRecord } from "../types.js";

const NOW = new Date("2026-07-08T12:00:00Z");

function record(overrides: Partial<OpportunityRecord>): OpportunityRecord {
  return {
    opportunityId: "OPP-TEST",
    accountName: "Test Co",
    opportunityName: "Test Deal",
    stage: "Validation",
    winLossStatus: "active",
    notes: "",
    region: "uk",
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("computes whole days from an ISO date", () => {
    expect(daysBetween("2026-07-01", NOW)).toBe(7);
  });

  it("returns null for missing or unparseable dates", () => {
    expect(daysBetween(undefined, NOW)).toBeNull();
    expect(daysBetween("not-a-date", NOW)).toBeNull();
    expect(daysBetween("", NOW)).toBeNull();
  });

  it("clamps future dates to 0", () => {
    expect(daysBetween("2026-07-20", NOW)).toBe(0);
  });
});

describe("activityHealth", () => {
  it("classifies from lastActivityDate buckets (7/14/30 days)", () => {
    expect(computeDealMetrics(record({ lastActivityDate: "2026-07-05" }), NOW).activityHealth).toBe("active");
    expect(computeDealMetrics(record({ lastActivityDate: "2026-06-26" }), NOW).activityHealth).toBe("cooling");
    expect(computeDealMetrics(record({ lastActivityDate: "2026-06-15" }), NOW).activityHealth).toBe("dormant");
    expect(computeDealMetrics(record({ lastActivityDate: "2026-05-01" }), NOW).activityHealth).toBe("dark");
  });

  it("falls back to updatedDate when lastActivityDate is missing, capped at cooling within 14 days", () => {
    const m = computeDealMetrics(record({ updatedDate: "2026-07-07" }), NOW);
    expect(m.activityHealth).toBe("cooling");
    expect(m.daysSinceLastActivity).toBeNull();
  });

  it("classifies dark from updatedDate only with >30 days of silence", () => {
    expect(computeDealMetrics(record({ updatedDate: "2026-06-20" }), NOW).activityHealth).toBe("dormant");
    expect(computeDealMetrics(record({ updatedDate: "2026-05-20" }), NOW).activityHealth).toBe("dark");
  });

  it("defaults to cooling when no date evidence exists", () => {
    expect(computeDealMetrics(record({}), NOW).activityHealth).toBe("cooling");
  });
});

describe("velocityAssessment", () => {
  it("accelerating: fresh stage, next step, activity within 3 days", () => {
    const m = computeDealMetrics(
      record({ updatedDate: "2026-07-07", lastActivityDate: "2026-07-06", nextStep: "Demo Friday" }),
      NOW
    );
    expect(m.velocityAssessment).toBe("accelerating");
    expect(m.isStalled).toBe(false);
  });

  it("on-track: stage age 2-4 days with a next step", () => {
    const m = computeDealMetrics(
      record({ updatedDate: "2026-07-05", lastActivityDate: "2026-07-04", nextStep: "Send proposal" }),
      NOW
    );
    expect(m.velocityAssessment).toBe("on-track");
  });

  it("slowing: stage age 4-8 days even with a next step", () => {
    const m = computeDealMetrics(
      record({ updatedDate: "2026-07-02", lastActivityDate: "2026-07-02", nextStep: "Follow up" }),
      NOW
    );
    expect(m.velocityAssessment).toBe("slowing");
  });

  it("stalled: stage age over 8 days", () => {
    const m = computeDealMetrics(
      record({ updatedDate: "2026-06-25", lastActivityDate: "2026-06-25", nextStep: "Follow up" }),
      NOW
    );
    expect(m.velocityAssessment).toBe("stalled");
    expect(m.isStalled).toBe(true);
  });

  it("slowing (not stalled): fresh deal with no documented next step", () => {
    // Regression: a single missing field must not read as a confirmed stall.
    // A deal touched today with no next step is a data-quality gap, not a
    // "ghost deal" — that miscalibration previously made every deal lacking
    // Next Step score in the high-teens/low-20s regardless of real freshness.
    const m = computeDealMetrics(
      record({ updatedDate: "2026-07-07", lastActivityDate: "2026-07-07" }),
      NOW
    );
    expect(m.velocityAssessment).toBe("slowing");
    expect(m.isStalled).toBe(false);
  });

  it("does not accelerate or go on-track without a next step, even when fresh", () => {
    const fresh = record({ updatedDate: "2026-07-08", lastActivityDate: "2026-07-08" });
    expect(computeDealMetrics(fresh, NOW).velocityAssessment).toBe("slowing");
  });

  it("stalled: last activity more than 14 days ago regardless of stage age", () => {
    const m = computeDealMetrics(
      record({ updatedDate: "2026-07-07", lastActivityDate: "2026-06-20", nextStep: "Call" }),
      NOW
    );
    expect(m.velocityAssessment).toBe("stalled");
  });

  it("is deterministic: same input, same output", () => {
    const r = record({ updatedDate: "2026-07-01", lastActivityDate: "2026-06-28", nextStep: "Demo" });
    expect(computeDealMetrics(r, NOW)).toEqual(computeDealMetrics(r, NOW));
  });
});
