/**
 * Region key normalisation — mirrors the backend rules in
 * functions/src/transforms/reportTransformer.ts (normalizeRegionKey).
 *
 * New reports write per-deal `region` as `na | uk | au`; older reports in
 * Firestore still carry `ANZ | NAMER | UK | Unknown`. The client accepts both
 * so regional tabs join deals onto the right slice regardless of vintage.
 */

export type RegionKey = 'na' | 'uk' | 'au';

export function normalizeRegionKey(raw: string | undefined): RegionKey | string {
  const lower = (raw ?? '').toLowerCase().trim();
  if (!lower) return 'unknown';
  // North America
  if (lower === 'na' || lower === 'us' || lower.includes('north america') || lower.includes('namer')) return 'na';
  // United Kingdom (includes EMEA/EU — Simpro UK is the only EMEA region)
  if (lower === 'uk' || lower === 'gb' || lower === 'eu' || lower.includes('united kingdom') || lower.includes('britain') || lower.includes('emea')) return 'uk';
  // AU / NZ combined (Simpro ANZ is a single region)
  if (
    lower === 'au' || lower === 'aus' || lower.includes('australia') ||
    lower === 'nz' || lower.includes('new zealand') ||
    lower === 'anz' || lower.includes('apac')
  ) return 'au';
  return lower;
}

const LABELS: Record<RegionKey, string> = {
  na: 'North America',
  uk: 'UK',
  au: 'AU / NZ',
};

/** Human label for a region key or raw value. Unknown values pass through. */
export function regionLabel(key: string | undefined): string {
  const normalized = normalizeRegionKey(key);
  if (normalized in LABELS) return LABELS[normalized as RegionKey];
  if (normalized === 'unknown') return 'Unknown';
  return key ?? 'Unknown';
}

/** Display order for region filters and tabs. */
export const REGION_LABEL_ORDER = [LABELS.na, LABELS.uk, LABELS.au];
