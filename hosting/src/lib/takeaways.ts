import type { DeltaDeal, FunnelStage, RiskDeal } from './types';
import { formatCurrency, normalizeStage, parseMoney } from './format';
import { isAtRisk, revenueConfidence, sumValue, type RiskDimension } from './dealMetrics';
import { isMisaligned } from './dealClassifiers';
import { repName } from './dealFilters';

/**
 * One-line panel takeaways. Every figure is computed here from deals or rows;
 * none is read out of LLM prose (project rule: numbers from code, prose from the LLM).
 */

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const pick = (count: number, one: string, many: string) => (count === 1 ? one : many);

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

export function driversTakeaway(confidence: number, dimensions: RiskDimension[]): string {
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
  return `${plural(todo.length, 'deal')} worth ${formatCurrency(sumValue(todo))} still ${pick(todo.length, 'needs', 'need')} a look.`;
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
  return `${stage} holds ${plural(list.length, 'HIGH-risk deal')} worth ${formatCurrency(sumValue(list))}.`;
}

export function activityTakeaway(deals: RiskDeal[]): string {
  const quiet = deals.filter(d => d.daysStalled >= 14);
  if (!quiet.length) return 'Every deal has had activity in the last two weeks.';
  return `${plural(quiet.length, 'deal')} worth ${formatCurrency(sumValue(quiet))} ${pick(quiet.length, 'has', 'have')} had no activity for 14+ days.`;
}

export function forecastTakeaway(deals: RiskDeal[]): string {
  const misaligned = deals.filter(isMisaligned);
  if (!misaligned.length) return 'Rep confidence and deal health line up across this view.';
  const n = misaligned.length;
  return `${plural(n, 'deal')} worth ${formatCurrency(sumValue(misaligned))} ${pick(n, 'looks', 'look')} stronger in the forecast than ${pick(n, 'its', 'their')} health suggests.`;
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
  return `${lowest.rep} has the lowest revenue confidence (${lowest.confidence}/100) with ${formatCurrency(lowest.atRisk)} at risk.`;
}

export function interventionsTakeaway(rows: { mrr?: string }[]): string {
  if (!rows.length) return 'Nothing in this view needs CRO intervention.';
  const value = rows.reduce((sum, r) => sum + parseMoney(r.mrr), 0);
  const worth = value > 0 ? ` worth ${formatCurrency(value)}` : '';
  return `${plural(rows.length, 'deal')}${worth} ${pick(rows.length, 'needs', 'need')} you personally.`;
}

export function changeTakeaway(worse: DeltaDeal[], better: DeltaDeal[]): string {
  if (!worse.length) {
    return better.length
      ? `${plural(better.length, 'deal')} improved and nothing got worse since the last run.`
      : 'No deal-level changes in this view since the last run.';
  }
  return `${plural(worse.length, 'deal')} got worse and ${better.length} improved. Biggest concern: ${worse[0].deal}.`;
}

export function competitorTakeaway(cards: { name: string; deals: number; value: number }[]): string {
  if (!cards.length) return 'No competitor threats recorded for this view.';
  const top = [...cards].sort((a, b) => b.value - a.value || b.deals - a.deals)[0];
  const worth = top.value > 0 ? ` worth ${formatCurrency(top.value)}` : '';
  return `${top.name} is the biggest threat here: ${plural(top.deals, 'deal')}${worth}.`;
}
