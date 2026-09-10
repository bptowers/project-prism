import { pipelineBasis, pipelineValue } from "./pipelineValue";

describe("pipelineValue / pipelineBasis", () => {
  it("prefers expected MRR when present", () => {
    expect(pipelineValue({ expectedMRR: 1500, amount: 18000 })).toBe(1500);
    expect(pipelineBasis({ expectedMRR: 1500, amount: 18000 })).toBe("mrr");
  });

  it("falls back to contract amount when MRR is absent", () => {
    expect(pipelineValue({ amount: 18000 })).toBe(18000);
    expect(pipelineBasis({ amount: 18000 })).toBe("amount");
  });

  it("treats a zero MRR as a real value, not as missing", () => {
    expect(pipelineValue({ expectedMRR: 0, amount: 18000 })).toBe(0);
    expect(pipelineBasis({ expectedMRR: 0, amount: 18000 })).toBe("mrr");
  });

  it("is undefined / amount-basis when neither exists", () => {
    expect(pipelineValue({})).toBeUndefined();
    expect(pipelineBasis({})).toBe("amount");
  });
});
