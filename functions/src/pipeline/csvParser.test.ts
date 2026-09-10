import { CSVParser } from "./csvParser";
import { OpportunityRecord } from "../types";

function record(overrides: Partial<OpportunityRecord> = {}): OpportunityRecord {
  return {
    opportunityId: "OPP-1",
    accountName: "Acme",
    opportunityName: "Acme Deal",
    stage: "Validation",
    winLossStatus: "active",
    notes: "",
    region: "UK",
    ...overrides,
  };
}

describe("CSVParser.calculateFunnel revenue basis", () => {
  it("sums expected MRR when present, falling back to amount per record", () => {
    const funnel = CSVParser.calculateFunnel([
      record({ expectedMRR: 100, amount: 5000 }),
      record({ opportunityId: "OPP-2", amount: 7000 }),
    ]);
    const validation = funnel.find((f) => f.stage === "Validation");
    expect(validation?.count).toBe(2);
    expect(validation?.revenue).toBe(7100);
  });
});
