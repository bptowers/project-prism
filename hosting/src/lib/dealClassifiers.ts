import type { RiskDeal } from './types';

/**
 * Deal classifiers shared by the stat cards, panel headers and widgets so a
 * count in one place always matches the list in another.
 */

/** No activity for 14–29 days. */
export function isDormant(deal: RiskDeal): boolean {
  return deal.daysStalled >= 14 && deal.daysStalled <= 29;
}

/** No activity for 30+ days. */
export function isDark(deal: RiskDeal): boolean {
  return deal.daysStalled >= 30;
}

/**
 * Rep confidence above 60% against a health score below 40. Deals without a
 * health score are never flagged — there is nothing to be misaligned with.
 */
export function isMisaligned(deal: RiskDeal): boolean {
  return typeof deal.healthScore === 'number' && deal.healthScore < 40 && deal.confidence > 60;
}

/** A forecast/win-rate stat of exactly 0% means the source had no closed deals to derive it from. */
export function isUnderivableRate(value: string | undefined): boolean {
  return value === '0%';
}
