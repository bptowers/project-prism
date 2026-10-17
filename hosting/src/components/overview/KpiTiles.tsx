import React from 'react';
import type { RiskDeal } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { formatCurrency } from '@/lib/format';
import { isAtRisk, sumValue } from '@/lib/dealMetrics';
import { plural } from '@/lib/takeaways';
import { scoreTextColor, smallCaps } from '@/components/ui/tone';

interface Tile {
  key: string;
  label: string;
  value: string;
  sub: string;
  color: string;
  link: string;
  filters: DealFilters;
}

/** Four headline numbers, each a door into the Deals tab. */
export const KpiTiles: React.FC<{ deals: RiskDeal[]; onSelect: (filters: DealFilters) => void }> = ({ deals, onSelect }) => {
  const atRisk = deals.filter(isAtRisk);
  const high = deals.filter(d => d.level === 'HIGH');
  const scored = deals.filter(d => typeof d.healthScore === 'number');
  const avgHealth = scored.length ? Math.round(scored.reduce((s, d) => s + (d.healthScore as number), 0) / scored.length) : null;
  const avgDays = deals.length ? Math.round(deals.reduce((s, d) => s + Math.max(0, d.daysStalled || 0), 0) / deals.length) : null;

  const tiles: Tile[] = [
    { key: 'pipeline', label: 'Pipeline value', value: formatCurrency(sumValue(deals)), sub: plural(deals.length, 'open deal'), color: 'var(--text-primary)', link: 'View all deals →', filters: {} },
    { key: 'atRisk', label: 'At risk', value: formatCurrency(sumValue(atRisk)), sub: `${plural(atRisk.length, 'deal')} · ${high.length} high`, color: 'var(--error-text)', link: 'View at-risk deals →', filters: { riskOnly: true } },
    {
      key: 'health', label: 'Avg deal health', value: avgHealth === null ? '—' : `${avgHealth}/100`,
      sub: avgHealth === null ? 'No health scores' : avgHealth >= 70 ? 'Healthy' : avgHealth >= 40 ? 'Caution' : 'At risk',
      color: scoreTextColor(avgHealth), link: 'View red deals →', filters: { band: 'Red' },
    },
    {
      key: 'quiet', label: 'Avg days since activity', value: avgDays === null ? '—' : `${avgDays}d`,
      sub: avgDays === null ? '' : avgDays <= 7 ? 'Healthy' : avgDays <= 21 ? 'Slowing' : 'Stalled',
      color: avgDays === null ? 'var(--text-muted)' : avgDays <= 7 ? 'var(--success-text)' : avgDays <= 21 ? 'var(--warning-text)' : 'var(--error-text)',
      link: 'View dark deals →', filters: { activity: 'dark' },
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: '0.85rem' }}>
      {tiles.map(tile => (
        <button key={tile.key} type="button" onClick={() => onSelect(tile.filters)} style={{
          textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '0.9rem 1.1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-primary)',
        }}>
          <span style={smallCaps}>{tile.label}</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: tile.color }}>{tile.value}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tile.sub}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>{tile.link}</span>
        </button>
      ))}
    </div>
  );
};
