import React from 'react';
import type { DeltaDeal, DeltaIntelligenceData, Region } from '@/lib/types';
import { asArray, isRecord } from '@/lib/guards';
import { normalizeRegionKey } from '@/lib/regions';
import { formatDate } from '@/lib/format';
import { linkButton, smallCaps } from '@/components/ui/tone';

interface Props {
  delta?: DeltaIntelligenceData;
  region: Region;
  onSeeChanges: () => void;
}

/** One-line "what moved since the last run" strip at the top of the Overview. */
export const SinceLastRun: React.FC<Props> = ({ delta, region, onSeeChanges }) => {
  const changes = isRecord(delta?.significantDealChanges) ? delta.significantDealChanges : undefined;
  if (!delta || !changes) return null;

  const inView = (d: DeltaDeal) => region === 'all' || normalizeRegionKey(d.region) === region;
  const worse = asArray<DeltaDeal>(changes.deteriorated).filter(inView).length;
  const better = asArray<DeltaDeal>(changes.improved).filter(inView).length;
  // newPipeline is portfolio-wide (no region), so only show it for All.
  const newPipeline = changes.newPipeline;
  const newDeals = region === 'all' && isRecord(newPipeline) && typeof newPipeline.count === 'number' ? newPipeline.count : undefined;
  const since = delta.comparedTo ? ` (${formatDate(delta.comparedTo)})` : '';

  return (
    <div role="status" aria-label="Changes since the last run" style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1.1rem',
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem 1.1rem',
    }}>
      <span style={smallCaps}>Since last run{since}</span>
      <span style={{ fontWeight: 700, color: 'var(--error-text)' }}>↓ {worse} got worse</span>
      <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>↑ {better} improved</span>
      {newDeals !== undefined && <span style={{ fontWeight: 700 }}>{newDeals} new deals</span>}
      <button type="button" onClick={onSeeChanges} style={{ ...linkButton, marginLeft: 'auto' }}>See what changed →</button>
    </div>
  );
};
