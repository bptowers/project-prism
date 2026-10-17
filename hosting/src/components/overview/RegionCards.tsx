import React from 'react';
import type { Region, RiskDeal } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { inRegion } from '@/lib/dealFilters';
import { isAtRisk, revenueConfidence, sumValue } from '@/lib/dealMetrics';
import { regionLabel } from '@/lib/regions';
import { plural, regionTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { scoreTextColor } from '@/components/ui/tone';

const REGION_KEYS = ['na', 'uk', 'au'] as const;

const Line: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
    <span>{label}</span>
    <span style={{ fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</span>
  </span>
);

interface Props {
  allDeals: RiskDeal[];
  region: Region;
  onSelectRegion: (region: Region) => void;
}

export const RegionCards: React.FC<Props> = ({ allDeals, region, onSelectRegion }) => {
  const rows = REGION_KEYS.map(key => {
    const deals = inRegion(allDeals, key);
    const atRisk = deals.filter(isAtRisk);
    return {
      key, label: regionLabel(key), dealCount: deals.length, pipeline: sumValue(deals),
      atRiskValue: sumValue(atRisk), atRiskCount: atRisk.length, confidence: revenueConfidence(deals),
    };
  });

  return (
    <InsightPanel label="Regions" question="Which region needs attention?" takeaway={regionTakeaway(rows)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.85rem' }}>
        {rows.map(row => {
          const active = region === row.key;
          return (
            <button key={row.key} type="button" aria-pressed={active} onClick={() => onSelectRegion(active ? 'all' : row.key)} style={{
              textAlign: 'left', border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--takeaway-bg)' : 'var(--bg-surface)', borderRadius: 10,
              padding: '0.85rem 1rem', cursor: 'pointer', color: 'var(--text-primary)',
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{row.label}</span>
              <Line label="Pipeline" value={formatCurrency(row.pipeline)} />
              <Line label="At risk" value={`${formatCurrency(row.atRiskValue)} · ${plural(row.atRiskCount, 'deal')}`} color="var(--error-text)" />
              <Line label="Confidence" value={`${row.confidence}/100`} color={scoreTextColor(row.confidence)} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
                {active ? 'Selected · click to show all regions' : `Focus on ${row.label}`}
              </span>
            </button>
          );
        })}
      </div>
    </InsightPanel>
  );
};
