import { buildPipelineMeta } from "./pipelineMeta";
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
      rejectedRecords: [{ opportunityId: "OPP-9", reasons: ["Missing stage"] }],
    });
  });

  it("describes an uncapped source (CSV) as not truncated with no row limit", () => {
    const meta = buildPipelineMeta(undefined, validation({ totalRecords: 42, rejected: [] }));
    expect(meta).toEqual({
      sourceTruncated: false,
      sourceRowLimit: null,
      sourceRowCount: 42,
      rejectedRecords: [],
    });
  });
});
