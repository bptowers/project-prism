import type { Region, RiskDeal } from './types';
import { normalizeRegionKey } from './regions';
import { normalizeStage, isLateStage, STAGE_ORDER } from './format';
import { riskBand, isAtRisk, type RiskBand } from './dealMetrics';

export type ActivityBucket = 'active' | 'cooling' | 'dormant' | 'dark';

/** The one definition of the activity thresholds; isDormant / isDark in dealClassifiers delegate here. */
export const ACTIVITY_BUCKETS: { key: ActivityBucket; label: string; range: string }[] = [
  { key: 'active', label: 'Active', range: '0–6 days' },
  { key: 'cooling', label: 'Cooling', range: '7–13 days' },
  { key: 'dormant', label: 'Dormant', range: '14–29 days' },
  { key: 'dark', label: 'Dark', range: '30+ days' },
];

export function activityBucket(daysStalled: number): ActivityBucket {
  if (daysStalled >= 30) return 'dark';
  if (daysStalled >= 14) return 'dormant';
  if (daysStalled >= 7) return 'cooling';
  return 'active';
}

export function repName(deal: RiskDeal): string {
  return deal.rep?.trim() || 'Unassigned';
}

/** Deals in one region. Region values are normalised so legacy names (ANZ, NAMER) match. */
export function inRegion(deals: RiskDeal[], region: Region): RiskDeal[] {
  if (region === 'all') return deals;
  return deals.filter(d => normalizeRegionKey(d.region) === region);
}

export interface DealFilters {
  rep?: string;
  stage?: string;
  band?: RiskBand;
  activity?: ActivityBucket;
  riskOnly?: boolean;
  lateOnly?: boolean;
}

export function applyDealFilters(deals: RiskDeal[], filters: DealFilters): RiskDeal[] {
  return deals.filter(d => {
    if (filters.rep && repName(d) !== filters.rep) return false;
    if (filters.stage && normalizeStage(d.stage) !== filters.stage) return false;
    if (filters.band && riskBand(d) !== filters.band) return false;
    if (filters.activity && activityBucket(d.daysStalled) !== filters.activity) return false;
    if (filters.riskOnly && !isAtRisk(d)) return false;
    if (filters.lateOnly && !isLateStage(d.stage)) return false;
    return true;
  });
}

export function repsIn(deals: RiskDeal[]): string[] {
  return [...new Set(deals.map(repName))].sort((a, b) => a.localeCompare(b));
}

export function stagesIn(deals: RiskDeal[]): string[] {
  const present = new Set(deals.map(d => normalizeStage(d.stage)));
  const known = STAGE_ORDER.filter(s => present.has(s));
  const other = [...present].filter(s => !STAGE_ORDER.includes(s)).sort((a, b) => a.localeCompare(b));
  return [...known, ...other];
}
