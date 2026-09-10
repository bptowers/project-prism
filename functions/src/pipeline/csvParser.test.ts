import { CSVParser, getDefaultRegionMapping, getDefaultSalesforceMapping } from "./csvParser";
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

describe("CSVParser.parse header handling", () => {
  const parser = () => new CSVParser(getDefaultSalesforceMapping(), getDefaultRegionMapping());

  it("strips a UTF-8 BOM so the first header column is recognised", () => {
    const csv = "﻿Opportunity_ID,Account_Name,Opportunity_Name,Stage\nOPP-1,Acme,Acme Deal,Discovery\n";
    const [rec] = parser().parse(csv);
    expect(rec.opportunityId).toBe("OPP-1");
  });

  it("keeps Account Name and Opportunity Name as distinct fields", () => {
    const csv = "Opportunity ID,Account Name,Opportunity Name,Stage\nOPP-1,Acme Electrical Ltd,Acme - New Business,Discovery\n";
    const [rec] = parser().parse(csv);
    expect(rec.accountName).toBe("Acme Electrical Ltd");
    expect(rec.opportunityName).toBe("Acme - New Business");
  });

  it("falls back to the opportunity name when the export has no account column", () => {
    const csv = "Opportunity_ID,Opportunity_Name,Stage\nOPP-1,Acme Deal,Discovery\n";
    const [rec] = parser().parse(csv);
    expect(rec.accountName).toBe("Acme Deal");
  });

  it.each([
    ["Opportunity_Owner"],
    ["Opportunity Owner"],
    ["Owner"],
    ["Owner.Name"],
    ["Sales_Rep"],
  ])("populates salesRep from the %s column", (header) => {
    const csv = `Opportunity_ID,Account_Name,Opportunity_Name,Stage,${header}\nOPP-1,Acme,Acme Deal,Discovery,Jane Rep\n`;
    const [rec] = parser().parse(csv);
    expect(rec.salesRep).toBe("Jane Rep");
  });

  it("does not read a Decision_Maker column as the sales rep", () => {
    const csv = "Opportunity_ID,Account_Name,Opportunity_Name,Stage,Decision_Maker\nOPP-1,Acme,Acme Deal,Discovery,Ops Director\n";
    const [rec] = parser().parse(csv);
    expect(rec.salesRep ?? "").toBe("");
  });
});
