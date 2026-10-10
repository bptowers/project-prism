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
  totalPipelineMrr: number | null;
  totalPipelineDisplay: string;
  /** Σ MRR × probability — the prompt's "Reported Pipeline". Amount-only deals excluded. */
  weightedPipelineMrr: string;
  /** weightedPipelineMrr without deals whose activityHealth is dark or dormant. */
  ghostStrippedWeightedMrr: string;
  /** MRR deals with no probability recorded, left out of both weighted views. */
  dealsWithoutProbability: number | null;
  /** Busiest region first. Empty when the per-deal lists are not available. */
  byRegion: RegionFacts[];
  /** Busiest stage first. Empty when the per-deal lists are not available. */
  byStage: StageFacts[];
  /** Most HIGH-risk deals first. Empty when the per-deal lists are not available. */
  byRep: RepFacts[];
}

export interface RepFacts {
  rep: string;
  activeDeals: number;
  highRiskDeals: number;
  highRiskMrr: string;
}

export interface RegionFacts {
  region: string;
  activeDeals: number;
  highRiskDeals: number;
  mediumRiskDeals: number;
  lowRiskDeals: number;
  highRiskMrr: string;
  pipelineMrr: string;
  weightedPipelineMrr: string;
}

export interface StageFacts {
  stage: string;
  activeDeals: number;
  highRiskDeals: number;
  highRiskMrr: string;
}

const NOT_AVAILABLE = "Not available in source data.";

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const sum = (deals: RiskDeal[]) => deals.reduce((acc, d) => acc + (d.amount ?? 0), 0);
const isMrr = (d: RiskDeal) => (d.pipelineBasis ?? "mrr") === "mrr";
const isHigh = (d: RiskDeal) => d.riskLevel === "high";

/**
 * "$X MRR", plus the Amount-only deals reported separately — Amount is total
 * contract value, so adding it to MRR would mix two different quantities.
 */
function valueDisplay(deals: RiskDeal[], qualifier = ""): string {
  const amountOnly = deals.filter((d) => !isMrr(d));
  let text = `${formatUsd(sum(deals.filter(isMrr)))} MRR`;
  if (amountOnly.length > 0) {
    const noun = amountOnly.length === 1 ? "deal" : "deals";
    text += ` (+${amountOnly.length} ${qualifier}${noun} with contract Amount only, no MRR: ${formatUsd(sum(amountOnly))})`;
  }
  return text;
}

function groupBy(deals: RiskDeal[], key: (d: RiskDeal) => string): Map<string, RiskDeal[]> {
  const groups = new Map<string, RiskDeal[]>();
  for (const d of deals) {
    const k = key(d);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return groups;
}

/** Σ MRR × probability over MRR-basis deals that have a probability. */
function weightedMrr(deals: RiskDeal[]): string {
  const total = deals
    .filter((d) => isMrr(d) && d.probability != null)
    .reduce((acc, d) => acc + (d.amount ?? 0) * (d.probability as number) / 100, 0);
  return `${formatUsd(total)} MRR`;
}

const isGhost = (d: RiskDeal) => d.activityHealth === "dark" || d.activityHealth === "dormant";

const busiestFirst = <T extends { activeDeals: number }>(key: (x: T) => string) =>
  (a: T, b: T) => b.activeDeals - a.activeDeals || key(a).localeCompare(key(b));

export function computePortfolioFacts(report: AggregatedReport): PortfolioFacts {
  const deals = Object.values(report.regions).flatMap((r) => r.allActiveDeals ?? []);

  if (deals.length === 0) {
    // allActiveDeals is cleared when a report is trimmed for Firestore. Reports
    // stored since the facts were persisted carry them; older ones only have
    // the code-computed global counts.
    if (report.portfolioFacts) return report.portfolioFacts;
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
      totalPipelineMrr: null,
      totalPipelineDisplay: NOT_AVAILABLE,
      weightedPipelineMrr: NOT_AVAILABLE,
      ghostStrippedWeightedMrr: NOT_AVAILABLE,
      dealsWithoutProbability: null,
      byRegion: [],
      byStage: [],
      byRep: [],
    };
  }

  const high = deals.filter(isHigh);
  const highAmountOnly = high.filter((d) => !isMrr(d));
  const stalled = deals.filter((d) => d.velocityAssessment === "stalled");
  const stalledMrr = sum(stalled.filter(isMrr));

  const byRegion: RegionFacts[] = Object.entries(report.regions)
    .map(([region, r]) => {
      const rd = r.allActiveDeals ?? [];
      return {
        region,
        activeDeals: rd.length,
        highRiskDeals: rd.filter(isHigh).length,
        mediumRiskDeals: rd.filter((d) => d.riskLevel === "medium").length,
        lowRiskDeals: rd.filter((d) => d.riskLevel === "low").length,
        highRiskMrr: valueDisplay(rd.filter(isHigh), "HIGH-risk "),
        pipelineMrr: valueDisplay(rd),
        weightedPipelineMrr: weightedMrr(rd),
      };
    })
    .filter((r) => r.activeDeals > 0)
    .sort(busiestFirst((r) => r.region));

  const byStage: StageFacts[] = [...groupBy(deals, (d) => d.stage || "Unknown")]
    .map(([stage, sd]) => ({
      stage,
      activeDeals: sd.length,
      highRiskDeals: sd.filter(isHigh).length,
      highRiskMrr: valueDisplay(sd.filter(isHigh), "HIGH-risk "),
    }))
    .sort(busiestFirst((s) => s.stage));

  const byRep: RepFacts[] = [...groupBy(deals, (d) => d.salesRep || "Unassigned")]
    .map(([rep, rd]) => ({
      rep,
      activeDeals: rd.length,
      highRiskDeals: rd.filter(isHigh).length,
      highRiskMrr: valueDisplay(rd.filter(isHigh), "HIGH-risk "),
    }))
    .sort((a, b) => b.highRiskDeals - a.highRiskDeals || b.activeDeals - a.activeDeals || a.rep.localeCompare(b.rep));

  return {
    activeDeals: deals.length,
    highRiskDeals: high.length,
    mediumRiskDeals: deals.filter((d) => d.riskLevel === "medium").length,
    lowRiskDeals: deals.filter((d) => d.riskLevel === "low").length,
    highRiskMrr: sum(high.filter(isMrr)),
    highRiskAmountOnlyDeals: highAmountOnly.length,
    highRiskAmountOnlyValue: sum(highAmountOnly),
    stalledDeals: stalled.length,
    stalledMrr,
    totalAtRiskDisplay: valueDisplay(high, "HIGH-risk "),
    stalledRevenueDisplay: `${formatUsd(stalledMrr)} MRR`,
    totalPipelineMrr: sum(deals.filter(isMrr)),
    totalPipelineDisplay: valueDisplay(deals),
    weightedPipelineMrr: weightedMrr(deals),
    ghostStrippedWeightedMrr: weightedMrr(deals.filter((d) => !isGhost(d))),
    dealsWithoutProbability: deals.filter((d) => isMrr(d) && d.probability == null).length,
    byRegion,
    byStage,
    byRep,
  };
}
