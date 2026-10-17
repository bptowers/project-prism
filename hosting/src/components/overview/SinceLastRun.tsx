import React from 'react';
import type { DeltaIntelligenceData, Region } from '@/lib/types';
import { asArray, isRecord } from '@/lib/guards';
import { normalizeRegionKey } from '@/lib/regions';
import { linkButton, smallCaps } from '@/components/ui/tone';

interface Props {
  delta?: DeltaIntelligenceData;
  region: Region;
  onSeeChanges: () => void;
}

const strip: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1.1rem',
  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem 1.1rem',
};

/**
 * One-line "what moved since the last run" strip at the top of the Overview.
 * Only counts rows; the LLM's own figures (newPipeline.count, comparedTo) are not shown.
 */
export const SinceLastRun: React.FC<Props> = ({ delta, region, onSeeChanges }) => {
  const changes = isRecord(delta?.significantDealChanges) ? delta.significantDealChanges : undefined;
  // Delta rows are unvalidated LLM JSON: drop non-objects and coerce region to a string.
  const count = (rows: unknown) => asArray<unknown>(rows)
    .filter(isRecord)
    .filter(d => region === 'all' || normalizeRegionKey(String(d.region ?? '')) === region)
    .length;

  return (
    <section aria-label="Since last run" style={strip}>
      <span style={smallCaps}>Since last run</span>
      {!delta ? (
        <span style={{ color: 'var(--text-secondary)' }}>No comparison with the last run yet.</span>
      ) : !changes ? (
        <span style={{ color: 'var(--text-secondary)' }}>Deal-level changes aren't available for this run.</span>
      ) : (
        <>
          <span style={{ fontWeight: 700, color: 'var(--error-text)' }}><span aria-hidden="true">↓</span> {count(changes.deteriorated)} got worse</span>
          <span style={{ fontWeight: 700, color: 'var(--success-text)' }}><span aria-hidden="true">↑</span> {count(changes.improved)} improved</span>
        </>
      )}
      {delta && <button type="button" onClick={onSeeChanges} style={{ ...linkButton, marginLeft: 'auto' }}>See what changed →</button>}
    </section>
  );
};
