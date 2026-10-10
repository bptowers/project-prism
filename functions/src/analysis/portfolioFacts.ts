/**
 * Project Prism - Portfolio facts
 *
 * Headline portfolio figures (risk counts, at-risk MRR, stalled MRR) computed
 * in code from the scored deals. The enrichment LLM is told to quote these
 * verbatim and its own `portfolioRisk` numbers are overwritten with them —
 * left to count for itself, it reported 78 HIGH-risk deals when the deal
 * table it was given held 105.
 */

import { AggregatedReport, RiskDeal } from "../types.js";

export interface PortfolioFacts {
  /** null when the per-deal lists are not available (e.g. a trimmed prior report). */
  activeDeals: number | null;
  highRiskDeals: number;
  mediumRiskDeals: number;
  lowRiskDeals: number | null;
  highRiskMrr: number | null;
  highRiskAmountOnlyDeals: number | null;
  highRiskAmountOnlyValue: number | null;
  stalledDeals: number | null;
  stalledMrr: number | null;
  totalAtRiskDisplay: string;
  stalledRevenueDisplay: string;
}

const NOT_AVAILABLE = "Not available in source data.";

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const sum = (deals: RiskDeal[]) => deals.reduce((acc, d) => acc + (d.amount ?? 0), 0);
const isMrr = (d: RiskDeal) => (d.pipelineBasis ?? "mrr") === "mrr";

export function computePortfolioFacts(report: AggregatedReport): PortfolioFacts {
  const deals = Object.values(report.regions).flatMap((r) => r.allActiveDeals ?? []);

  if (deals.length === 0) {
    // allActiveDeals is cleared when a report is trimmed for Firestore; the
    // code-computed global counts survive, the money figures do not.
    return {
      activeDeals: null,
      highRiskDeals: report.global.highRiskCount,
      mediumRiskDeals: report.global.mediumRiskCount,
      lowRiskDeals: null,
      highRiskMrr: null,
      highRiskAmountOnlyDeals: null,
      highRiskAmountOnlyValue: null,
      stalledDeals: null,
      stalledMrr: null,
      totalAtRiskDisplay: NOT_AVAILABLE,
      stalledRevenueDisplay: NOT_AVAILABLE,
    };
  }

  const high = deals.filter((d) => d.riskLevel === "high");
  const highMrr = high.filter(isMrr);
  const highAmountOnly = high.filter((d) => !isMrr(d));
  const stalled = deals.filter((d) => d.velocityAssessment === "stalled");
  const stalledMrr = sum(stalled.filter(isMrr));

  let totalAtRiskDisplay = `${formatUsd(sum(highMrr))} MRR`;
  if (highAmountOnly.length > 0) {
    const noun = highAmountOnly.length === 1 ? "deal" : "deals";
    totalAtRiskDisplay +=
      ` (+${highAmountOnly.length} HIGH-risk ${noun} with contract Amount only, no MRR: ${formatUsd(sum(highAmountOnly))})`;
  }

  return {
    activeDeals: deals.length,
    highRiskDeals: high.length,
    mediumRiskDeals: deals.filter((d) => d.riskLevel === "medium").length,
    lowRiskDeals: deals.filter((d) => d.riskLevel === "low").length,
    highRiskMrr: sum(highMrr),
    highRiskAmountOnlyDeals: highAmountOnly.length,
    highRiskAmountOnlyValue: sum(highAmountOnly),
    stalledDeals: stalled.length,
    stalledMrr,
    totalAtRiskDisplay,
    stalledRevenueDisplay: `${formatUsd(stalledMrr)} MRR`,
  };
}
