import { Analyzer } from "./analyzer";
import { DataValidator } from "../pipeline/validator";
import { ILLMProvider, LLMAnalysisOutput, LLMCompletionOutput } from "../llm/provider";
import { ExecutionContext, OpportunityRecord } from "../types";

function record(overrides: Partial<OpportunityRecord> = {}): OpportunityRecord {
  return {
    opportunityId: "OPP-1",
    accountName: "Acme Ltd",
    opportunityName: "Acme - New Business",
    stage: "Discovery",
    winLossStatus: "active",
    notes: "Champion engaged.",
    region: "UK",
    ...overrides,
  };
}

function context(): ExecutionContext {
  return {
    executionId: "exec_test",
    startTime: new Date(),
    jobType: "manual",
    recordsProcessed: 0,
    recordsSuccessful: 0,
    recordsFailed: 0,
    status: "running",
    errors: [],
    tokenUsage: { input: 0, output: 0 },
  };
}

/** Provider fake that records which opportunities it was asked to analyse. */
class RecordingProvider implements ILLMProvider {
  seen: string[] = [];
  async analyze(opps: OpportunityRecord[]): Promise<LLMAnalysisOutput[]> {
    return opps.map((o) => {
      this.seen.push(o.opportunityId);
      return {
        success: true,
        rawResponse: "{}",
        processingTimeMs: 1,
        analysis: {
          opportunityId: o.opportunityId,
          dealHealthScore: 70,
          stakeholderCoverage: "multi-threaded",
          competitorThreat: "none",
          riskSignals: { level: "low", signals: [], summary: "ok" },
          recommendedAction: { priority: "P3", action: "Keep going", owner: "AE", deadline: "This week" },
        },
      };
    });
  }
  async complete(): Promise<LLMCompletionOutput> {
    return { text: "" };
  }
  async validateConnection(): Promise<void> {}
  getProviderInfo() {
    return { name: "fake", model: "fake-1", version: "0" };
  }
}

describe("Analyzer.analyze validation pass", () => {
  it("re-uses a supplied validation report instead of validating again", async () => {
    const provider = new RecordingProvider();
    const analyzer = new Analyzer(provider, 2, 0, 0);
    const records = [record(), record({ opportunityId: "OPP-2" })];

    // Pre-computed report marks OPP-2 invalid even though it is structurally fine —
    // if the analyzer re-validated, OPP-2 would slip through to the provider.
    const validationReport = new DataValidator().validateBatch(records);
    validationReport.recordValidations[1].isValid = false;

    const validateSpy = jest.spyOn(DataValidator.prototype, "validateBatch");
    try {
      const results = await analyzer.analyze(records, context(), { validationReport });
      expect(validateSpy).not.toHaveBeenCalled();
      expect(provider.seen).toEqual(["OPP-1"]);
      expect(results.map((r) => r.opportunityId)).toEqual(["OPP-1"]);
    } finally {
      validateSpy.mockRestore();
    }
  });

  it("still validates internally when no report is supplied", async () => {
    const provider = new RecordingProvider();
    const analyzer = new Analyzer(provider, 2, 0, 0);
    const records = [record(), record({ opportunityId: "OPP-2", stage: "" })];
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await analyzer.analyze(records, context());
      expect(provider.seen).toEqual(["OPP-1"]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("Analyzer.analyze validation report alignment guard", () => {
  it("re-validates when the supplied report was built for a different record set", async () => {
    const provider = new RecordingProvider();
    const analyzer = new Analyzer(provider, 2, 0, 0);
    const records = [record(), record({ opportunityId: "OPP-2", stage: "" })];
    // Report built for a single record — indexes would not line up with `records`
    const stale = new DataValidator().validateBatch([record()]);
    const validateSpy = jest.spyOn(DataValidator.prototype, "validateBatch");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await analyzer.analyze(records, context(), { validationReport: stale });
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(provider.seen).toEqual(["OPP-1"]); // OPP-2 (no stage) rejected by the fresh pass
    } finally {
      validateSpy.mockRestore();
      warn.mockRestore();
    }
  });
});
