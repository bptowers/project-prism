import type { Region } from './types';
import type { RiskBand } from './dealMetrics';
import type { ActivityBucket, DealFilters } from './dealFilters';

export type TabKey = 'overview' | 'cro' | 'deals' | 'health' | 'comp';

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'cro', label: 'CRO Brief' },
  { key: 'deals', label: 'Deals' },
  { key: 'health', label: 'Pipeline Health' },
  { key: 'comp', label: 'Competition & Change' },
];

/** Everything that decides what the dashboard shows. Mirrored in the URL hash. */
export interface DashboardView extends DealFilters {
  tab: TabKey;
  region: Region;
  hideReviewed?: boolean;
}

const TAB_KEYS = new Set<string>(TABS.map(t => t.key));
const REGIONS = new Set<string>(['all', 'na', 'uk', 'au']);
const BANDS = new Set<string>(['Green', 'Yellow', 'Red']);
const BUCKETS = new Set<string>(['active', 'cooling', 'dormant', 'dark']);

export function parseHash(hash: string): Partial<DashboardView> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const q = raw.indexOf('?');
  const path = q === -1 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q === -1 ? '' : raw.slice(q + 1));
  const view: Partial<DashboardView> = {};

  if (TAB_KEYS.has(path)) view.tab = path as TabKey;
  const region = params.get('region');
  if (region && REGIONS.has(region)) view.region = region as Region;
  // Blank values (e.g. rep=%20 from a mangled link) would filter to zero deals, so drop them.
  const rep = params.get('rep')?.trim();
  if (rep) view.rep = rep;
  const stage = params.get('stage')?.trim();
  if (stage) view.stage = stage;
  const band = params.get('band');
  if (band && BANDS.has(band)) view.band = band as RiskBand;
  const activity = params.get('activity');
  if (activity && BUCKETS.has(activity)) view.activity = activity as ActivityBucket;
  if (params.get('risk') === '1') view.riskOnly = true;
  if (params.get('late') === '1') view.lateOnly = true;
  if (params.get('hideReviewed') === '1') view.hideReviewed = true;
  return view;
}

export function toHash(view: DashboardView): string {
  const params = new URLSearchParams();
  params.set('region', view.region);
  if (view.rep) params.set('rep', view.rep);
  if (view.stage) params.set('stage', view.stage);
  if (view.band) params.set('band', view.band);
  if (view.activity) params.set('activity', view.activity);
  if (view.riskOnly) params.set('risk', '1');
  if (view.lateOnly) params.set('late', '1');
  if (view.hideReviewed) params.set('hideReviewed', '1');
  return `#${view.tab}?${params.toString()}`;
}
