/**
 * Project Prism - Pipeline value basis
 *
 * A deal's "pipeline value" on the dashboard is its Expected MRR when the rep
 * entered one, otherwise the opportunity Amount (total contract value). The
 * two are different quantities, so the raw fields stay separate on the record
 * and every consumer that needs the blended figure goes through these helpers
 * — and can say which basis it is showing.
 */

export type PipelineBasis = "mrr" | "amount";

export interface PipelineValued {
  amount?: number;
  expectedMRR?: number;
}

/** Expected MRR if present (0 counts as present), otherwise Amount. */
export function pipelineValue(deal: PipelineValued): number | undefined {
  return deal.expectedMRR ?? deal.amount;
}

/** Which field pipelineValue() is reporting for this deal. */
export function pipelineBasis(deal: PipelineValued): PipelineBasis {
  return deal.expectedMRR != null ? "mrr" : "amount";
}
