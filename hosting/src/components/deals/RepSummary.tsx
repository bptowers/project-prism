import React from 'react';
import type { Region, RiskDeal } from '@/lib/types';
import { formatValue } from '@/lib/format';
import { isAtRisk, revenueConfidence, sumValue } from '@/lib/dealMetrics';
import { plural } from '@/lib/takeaways';
import { regionLabel } from '@/lib/regions';
import { scoreTextColor } from '@/components/ui/tone';

interface Props {
  rep: string;
  repDeals: RiskDeal[];
  regionDeals: RiskDeal[];
  region: Region;
}

const box: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 1.2rem',
  padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)',
};

/** A rep's headline numbers. Their 8–15 deals are too few for useful charts. */
export const RepSummary: React.FC<Props> = ({ rep, repDeals, regionDeals, region }) => {
  // A rep from the URL or a previous region can have no deals here; "0 deals · Confidence 0/100" would misread as a weak rep.
  if (repDeals.length === 0) {
    return (
      <div role="status" aria-label={`Summary for ${rep}`} style={{ ...box, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
        No deals for {rep} in {region === 'all' ? 'any region' : regionLabel(region)}
      </div>
    );
  }

  const regionName = region === 'all' ? 'all-regions' : regionLabel(region);
  const confidence = revenueConfidence(repDeals);
  const diff = confidence - revenueConfidence(regionDeals);
  const comparison = diff === 0
    ? `level with the ${regionName} average`
    : `${Math.abs(diff)} points ${diff > 0 ? 'above' : 'below'} the ${regionName} average`;
  const atRisk = repDeals.filter(isAtRisk);

  return (
    <div role="status" aria-label={`Summary for ${rep}`} style={box}>
      <strong style={{ fontSize: '1rem', overflowWrap: 'anywhere' }}>{rep}</strong>
      <span>{plural(repDeals.length, 'deal')}</span>
      <span>{formatValue(sumValue(repDeals), repDeals.length)} pipeline</span>
      <span style={{ fontWeight: 700, color: 'var(--error-text)' }}>{formatValue(sumValue(atRisk), atRisk.length)} at risk</span>
      <span style={{ fontWeight: 700, color: scoreTextColor(confidence) }}>Confidence {confidence}/100</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{comparison}</span>
    </div>
  );
};
