import { buildPipelineMeta, capRejectedRecords } from "./pipelineMeta";
import { ValidationReport } from "../types";

function validation(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    totalRecords: 10,
    validRecords: 9,
    invalidRecords: 1,
    averageQualityScore: 80,
    totalPiiIssues: 2,
    recordValidations: [],
    rejected: [{ opportunityId: "OPP-9", reasons: ["Missing stage"] }],
    timestamp: new Date("2026-09-10T00:00:00Z"),
    ...overrides,
  };
}

describe("buildPipelineMeta", () => {
  it("combines BigQuery fetch telemetry with validator rejections", () => {
    const meta = buildPipelineMeta(
      { truncated: true, rowLimit: 300, rowCount: 300 },
      validation({ totalRecords: 300 })
    );
    expect(meta).toEqual({
      sourceTruncated: true,
      sourceRowLimit: 300,
      sourceRowCount: 300,
      rejectedCount: 1,
      rejectedRecords: [{ opportunityId: "OPP-9", reasons: ["Missing stage"] }],
    });
  });

  it("describes an uncapped source (CSV) as not truncated with no row limit", () => {
    const meta = buildPipelineMeta(undefined, validation({ totalRecords: 42, rejected: [] }));
    expect(meta).toEqual({
      sourceTruncated: false,
      sourceRowLimit: null,
      sourceRowCount: 42,
      rejectedCount: 0,
      rejectedRecords: [],
    });
  });

  it("rejectedCount equals the full rejection list length", () => {
    const rejected = Array.from({ length: 7 }, (_, i) => ({ opportunityId: `OPP-${i}`, reasons: ["Missing stage"] }));
    const meta = buildPipelineMeta(undefined, validation({ rejected }));
    expect(meta.rejectedCount).toBe(7);
    expect(meta.rejectedRecords).toHaveLength(7);
  });
});

describe("capRejectedRecords", () => {
  const rejected = Array.from({ length: 5 }, (_, i) => ({ opportunityId: `OPP-${i}`, reasons: ["Missing stage"] }));
  const meta = buildPipelineMeta(undefined, validation({ rejected }));

  it("truncates the list but keeps rejectedCount as the true total", () => {
    const capped = capRejectedRecords(meta, 2)!;
    expect(capped.rejectedRecords.map((r) => r.opportunityId)).toEqual(["OPP-0", "OPP-1"]);
    expect(capped.rejectedCount).toBe(5);
  });

  it("returns the input unchanged when under the cap and never mutates it", () => {
    expect(capRejectedRecords(meta, 10)).toBe(meta);
    capRejectedRecords(meta, 2);
    expect(meta.rejectedRecords).toHaveLength(5);
  });

  it("passes undefined through for runs that never reached validation", () => {
    expect(capRejectedRecords(undefined, 2)).toBeUndefined();
  });
});
