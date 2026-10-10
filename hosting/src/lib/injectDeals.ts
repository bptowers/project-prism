import type { ReportDocument, RiskDeal } from './types';
import { normalizeRegionKey } from './regions';

/**
 * Merge the uncapped `/reports/{date}/deals` subcollection into a report's
 * transformed slices.
 *
 * Deals are grouped by the normalised region key so both new reports (`na |
 * uk | au`) and legacy ones (`NAMER | UK | ANZ`) land on the right tab. Each
 * injected deal's `region` is rewritten to that key so downstream widgets see
 * one vocabulary. Pure — returns a new report and never mutates the input.
 */
export function injectDeals(report: ReportDocument, deals: RiskDeal[]): ReportDocument {
  if (!report.transformed || deals.length === 0) return report;

  const normalised = deals.map(deal => ({ ...deal, region: normalizeRegionKey(deal.region) }));

  const byRegion: Record<string, RiskDeal[]> = {};
  for (const deal of normalised) {
    (byRegion[deal.region] ??= []).push(deal);
  }

  const transformed = { ...report.transformed };
  if (transformed.all) {
    transformed.all = { ...transformed.all, risks: normalised };
  }
  for (const [key, regionDeals] of Object.entries(byRegion)) {
    if (transformed[key]) {
      transformed[key] = { ...transformed[key], risks: regionDeals };
    }
  }

  return { ...report, transformed };
}

/** Deal counts per normalised region key — drives the RegionTabs badges. */
export function countDealsByRegion(deals: RiskDeal[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const deal of deals) {
    const key = normalizeRegionKey(deal.region);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
