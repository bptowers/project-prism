import React from 'react';
import type { RiskDeal } from '@/lib/types';

interface Props {
  risks: RiskDeal[];
}

function formatCurrency(value: number): string {
  if (value <= 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

interface Bucket {
  label: string;
  range: string;
  color: string;
  test: (days: number) => boolean;
}

const BUCKETS: Bucket[] = [
  { label: 'Active',  range: '0–6 days',   color: 'var(--success)', test: d => d >= 0 && d <= 6 },
  { label: 'Cooling', range: '7–13 days',  color: 'var(--warning)', test: d => d >= 7 && d <= 13 },
  { label: 'Dormant', range: '14–29 days', color: 'var(--error)',   test: d => d >= 14 && d <= 29 },
  { label: 'Dark',    range: '30+ days',   color: '#666',            test: d => d >= 30 },
];

export const ActivityHealth: React.FC<Props> = ({ risks }) => {
  if (risks.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
      }}>
        No activity data
      </div>
    );
  }

  const total = risks.length;

  const buckets = BUCKETS.map(b => {
    const deals = risks.filter(r => b.test(r.daysStalled));
    const pipelineValue = deals.reduce((sum, r) => sum + (r.pipelineValue ?? 0), 0);
    return { ...b, count: deals.length, pipelineValue };
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0.75rem',
    }}>
      {buckets.map(b => {
        const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
        return (
          <div
            key={b.label}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              borderLeft: `3px solid ${b.color}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: b.color,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                {b.label}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.62rem',
                color: 'var(--text-muted)',
                marginLeft: 'auto',
              }}>
                {b.range}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: b.count > 0 ? b.color : 'var(--text-muted)',
                lineHeight: 1,
              }}>
                {b.count}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
              }}>
                {pct}%
              </span>
            </div>

            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: b.pipelineValue > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
            }}>
              {b.pipelineValue > 0 ? formatCurrency(b.pipelineValue) : '—'}
              {b.pipelineValue > 0 && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>at risk</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
