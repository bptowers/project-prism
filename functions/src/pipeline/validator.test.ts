import { DataValidator } from "./validator";
import { OpportunityRecord } from "../types";

function record(overrides: Partial<OpportunityRecord> = {}): OpportunityRecord {
  return {
    opportunityId: "OPP-1",
    accountName: "Acme Ltd",
    opportunityName: "Acme - New Business",
    stage: "Discovery",
    winLossStatus: "active",
    notes: "Champion engaged; demo booked.",
    region: "UK",
    ...overrides,
  };
}

describe("DataValidator.validateBatch rejection telemetry", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it("returns an empty rejected list when every record is valid", () => {
    const report = new DataValidator().validateBatch([record(), record({ opportunityId: "OPP-2" })]);
    expect(report.rejected).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("lists each rejected record with its opportunityId and reasons", () => {
    const report = new DataValidator().validateBatch([
      record(),
      record({ opportunityId: "OPP-2", accountName: "", stage: "" }),
    ]);
    expect(report.invalidRecords).toBe(1);
    expect(report.rejected).toEqual([
      { opportunityId: "OPP-2", reasons: ["Missing accountName", "Missing stage"] },
    ]);
  });

  it("falls back to a positional id when opportunityId itself is missing", () => {
    const report = new DataValidator().validateBatch([record({ opportunityId: "" })]);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].opportunityId).toBe("record_0");
    expect(report.rejected[0].reasons).toContain("Missing opportunityId");
  });

  it("warns one line per rejected record naming the id and reasons", () => {
    new DataValidator().validateBatch([
      record({ opportunityId: "OPP-2", stage: "" }),
      record({ opportunityId: "OPP-3", accountName: "" }),
    ]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toMatch(/OPP-2.*Missing stage/);
    expect(warn.mock.calls[1][0]).toMatch(/OPP-3.*Missing accountName/);
  });

  it("counts PII issues caught across the batch", () => {
    const report = new DataValidator().validateBatch([
      record({ notes: "Call jane@example.com tomorrow" }),
      record({ opportunityId: "OPP-2", notes: "SSN 123-45-6789 on file, email bob@example.com" }),
      record({ opportunityId: "OPP-3" }),
    ]);
    // one PII type on record 1, two on record 2
    expect(report.totalPiiIssues).toBe(3);
  });
});
