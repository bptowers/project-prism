import type { DeltaDeal, FunnelStage, RiskDeal } from './types';
import { formatCurrency, normalizeStage, parseMoney } from './format';
import { isAtRisk, revenueConfidence, sumValue, type RiskDimension } from './dealMetrics';
import { isMisaligned } from './dealClassifiers';
import { repName } from './dealFilters';
import { text } from './guards';

/**
 * One-line panel takeaways. Nothing is read out of LLM prose (project rule: numbers
 * from code, prose from the LLM). Counts, confidence and deal values come from the
 * deals themselves. The exception is money summed from LLM rows: the per-deal `mrr`
 * the AI copies into CRO question rows and Q6 `mrrAtRisk` are the AI's own figures,
 * so those totals are labelled "(AI-reported)" or "(AI estimate)".
 */

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const pick = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** " worth $X", or nothing when there is no value: pipelineValue is often 0, and "$0" misleads. */
const worth = (value: number) => (value > 0 ? ` worth ${formatCurrency(value)}` : '');

export function riskMapTakeaway(deals: RiskDeal[]): string {
  const atRisk = deals.filter(isAtRisk);
  if (!atRisk.length) return 'No deals are flagged at risk in this view.';
  const high = deals.filter(d => d.level === 'HIGH');
  const atRiskValue = sumValue(atRisk);
  if (atRiskValue <= 0) {
    return `${plural(atRisk.length, 'deal')} ${pick(atRisk.length, 'is', 'are')} flagged at risk, ${high.length} of them HIGH.`;
  }
  const share = Math.round((sumValue(high) / atRiskValue) * 100);
  return `${plural(high.length, 'HIGH-risk deal')} ${pick(high.length, 'holds', 'hold')} ${share}% of the ${formatCurrency(atRiskValue)} at risk.`;
}

export function driversTakeaway(dealCount: number, confidence: number, dimensions: RiskDimension[]): string {
  if (!dealCount) return 'No deals in this view.';
  const ranked = [...dimensions].filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  if (!ranked.length) return `Revenue confidence is ${confidence}/100. No single risk driver stands out.`;
  const then = ranked[1] ? `, then ${ranked[1].label.toLowerCase()}` : '';
  return `Revenue confidence is ${confidence}/100. ${ranked[0].label} is the biggest risk driver${then}.`;
}

export function regionTakeaway(rows: { label: string; confidence: number; dealCount: number }[]): string {
  const withDeals = rows.filter(r => r.dealCount > 0);
  if (!withDeals.length) return 'No regional data in this report.';
  const lowest = [...withDeals].sort((a, b) => a.confidence - b.confidence)[0];
  return `${lowest.label} has the lowest revenue confidence (${lowest.confidence}/100).`;
}

export function queueTakeaway(queue: RiskDeal[], isDone: (deal: RiskDeal) => boolean): string {
  if (!queue.length) return 'No late-stage deals in this view.';
  const todo = queue.filter(d => !isDone(d));
  if (!todo.length) return 'All done: every deal in this queue has been reviewed.';
  return `${plural(todo.length, 'deal')}${worth(sumValue(todo))} still ${pick(todo.length, 'needs', 'need')} a look.`;
}

export function stageTakeaway(deals: RiskDeal[]): string {
  const byStage = new Map<string, RiskDeal[]>();
  for (const d of deals.filter(x => x.level === 'HIGH')) {
    const stage = normalizeStage(d.stage);
    byStage.set(stage, [...(byStage.get(stage) ?? []), d]);
  }
  if (!byStage.size) return 'No HIGH-risk deals in this view.';
  const [stage, list] = [...byStage.entries()]
    .sort((a, b) => sumValue(b[1]) - sumValue(a[1]) || b[1].length - a[1].length)[0];
  return `${stage} holds ${plural(list.length, 'HIGH-risk deal')}${worth(sumValue(list))}.`;
}

export function activityTakeaway(deals: RiskDeal[]): string {
  const quiet = deals.filter(d => d.daysStalled >= 14);
  if (!quiet.length) return 'Every deal has had activity in the last two weeks.';
  return `${plural(quiet.length, 'deal')}${worth(sumValue(quiet))} ${pick(quiet.length, 'has', 'have')} had no activity for 14+ days.`;
}

export function forecastTakeaway(deals: RiskDeal[]): string {
  const misaligned = deals.filter(isMisaligned);
  if (!misaligned.length) return 'Rep confidence and deal health line up across this view.';
  const n = misaligned.length;
  return `${plural(n, 'deal')}${worth(sumValue(misaligned))} ${pick(n, 'looks', 'look')} stronger in the forecast than ${pick(n, 'its', 'their')} health suggests.`;
}

const EARLY_STAGES = new Set(['Discovery', 'Qualification', 'Solution']);

export function funnelTakeaway(stages: FunnelStage[]): string {
  if (!stages.length) return 'No stage data in this report.';
  const early = stages.filter(s => EARLY_STAGES.has(normalizeStage(s.stage))).reduce((n, s) => n + s.count, 0);
  const later = stages.filter(s => !EARLY_STAGES.has(normalizeStage(s.stage))).reduce((n, s) => n + s.count, 0);
  const thin = early < later / 2 ? ' Early pipeline looks thin for next quarter.' : '';
  return `${plural(early, 'deal')} in early stages and ${later} in later stages.${thin}`;
}

export function repTakeaway(deals: RiskDeal[]): string {
  const byRep = new Map<string, RiskDeal[]>();
  for (const d of deals) byRep.set(repName(d), [...(byRep.get(repName(d)) ?? []), d]);
  if (!byRep.size) return 'No reps in this view.';
  const rows = [...byRep.entries()].map(([rep, list]) => ({
    rep,
    confidence: revenueConfidence(list),
    atRisk: sumValue(list.filter(isAtRisk)),
  }));
  const lowest = rows.sort((a, b) => a.confidence - b.confidence)[0];
  const atRisk = lowest.atRisk > 0 ? ` with ${formatCurrency(lowest.atRisk)} at risk` : '';
  return `${lowest.rep} has the lowest revenue confidence (${lowest.confidence}/100)${atRisk}.`;
}

export function interventionsTakeaway(rows: { mrr?: string }[]): string {
  if (!rows.length) return 'Nothing in this view needs CRO intervention.';
  const value = rows.reduce((sum, r) => sum + parseMoney(r.mrr), 0);
  // The rows' mrr is transcribed by the LLM, so the total is labelled as the AI's.
  const reported = value > 0 ? `${worth(value)} (AI-reported)` : '';
  return `${plural(rows.length, 'deal')}${reported} ${pick(rows.length, 'needs', 'need')} you personally.`;
}

const URGENCY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
// Delta rows are unvalidated LLM JSON, so fields are coerced rather than trusted to be strings.
const urgencyRank = (deal: DeltaDeal) => URGENCY_RANK[String(deal.urgency ?? '').trim().toUpperCase()] ?? 3;
const dealName = (deal: DeltaDeal) => text(deal.deal).trim();

/** Most urgent first, then highest MRR, then name, so the pick never depends on the LLM's ordering. */
function byConcern(a: DeltaDeal, b: DeltaDeal): number {
  return urgencyRank(a) - urgencyRank(b) || parseMoney(b.mrr) - parseMoney(a.mrr) || dealName(a).localeCompare(dealName(b));
}

export function changeTakeaway(worse: DeltaDeal[], better: DeltaDeal[]): string {
  if (!worse.length) {
    return better.length
      ? `${plural(better.length, 'deal')} improved and nothing got worse since the last run.`
      : 'No deal-level changes in this view since the last run.';
  }
  const concern = dealName([...worse].sort(byConcern)[0]);
  return `${plural(worse.length, 'deal')} got worse and ${better.length} improved.${concern ? ` Biggest concern: ${concern}.` : ''}`;
}

/**
 * Ranked by value at risk only: a card's deal count is the AI's own affectedDeals
 * figure, so it is never quoted here. A competitor with AI-reported deals but no
 * value is only mentioned (as a count of competitors) when nothing has a value.
 */
export function competitorTakeaway(cards: { name: string; deals: number; value: number }[]): string {
  if (!cards.length) return 'No competitor threats recorded for this view.';
  const valued = cards.filter(c => c.value > 0);
  if (valued.length) {
    const top = [...valued].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))[0];
    // value is summed from the AI's per-competitor mrrAtRisk: ranked on, but labelled as an estimate.
    return `${top.name} is the biggest threat here: about ${formatCurrency(top.value)} at risk (AI estimate).`;
  }
  const flagged = cards.filter(c => c.deals > 0).length;
  if (flagged) return `${plural(flagged, 'competitor')} ${pick(flagged, 'is', 'are')} flagged by the AI.`;
  // Loss-history cards carry no open deals or value; never name one as a "threat: 0 deals".
  return `No open deals are flagged against a competitor in this view. ${plural(cards.length, 'competitor')} ${pick(cards.length, 'appears', 'appear')} in past losses.`;
}
