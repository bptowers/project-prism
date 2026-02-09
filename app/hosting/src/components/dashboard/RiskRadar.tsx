import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { RiskDeal } from '@/lib/types';

interface Props { risks: RiskDeal[]; }

export const RiskRadar: React.FC<Props> = ({ risks }) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div>
      {risks.map(r => (
        <div key={r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          style={{
            padding: '1rem', border: '1px solid var(--border)', borderRadius: 8,
            marginBottom: '0.75rem', background: 'var(--bg-elevated)', cursor: 'pointer',
            borderLeft: `3px solid ${r.level === 'HIGH' ? 'var(--error)' : 'var(--accent)'}`,
            transition: 'all 0.15s ease',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 500 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, letterSpacing: '0.5px' }}>OPP ID</span> #{r.id}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 500 }}>{r.value}</span>
              <span style={{ padding: '2px 6px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.region}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--prism-blue)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 30, height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden', display: 'inline-block' }}>
                  <span style={{ display: 'block', width: `${r.confidence}%`, height: '100%', background: 'var(--prism-blue)', borderRadius: 2 }} />
                </span>
                {r.confidence}%
              </span>
              <Badge variant={r.level === 'HIGH' ? 'high' : 'medium'}>{r.level}</Badge>
            </div>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.summary}</div>
          {expanded === r.id && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--accent-subtle)', padding: '0.5rem 0.75rem', borderRadius: 4,
                fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.5rem',
              }}>
                ✓ {r.action}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--error)', marginTop: '0.5rem' }}>
                Stalled: {r.daysStalled} days
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
