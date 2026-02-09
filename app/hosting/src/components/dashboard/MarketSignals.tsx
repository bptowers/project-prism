import React from 'react';
import type { MarketSignal } from '@/lib/types';

interface Props { signals: MarketSignal[]; }

export const MarketSignals: React.FC<Props> = ({ signals }) => (
  <div>
    {signals.map((s, i) => {
      const icon = s.dir === 'up' ? '↑' : s.dir === 'down' ? '↓' : '→';
      const cls = s.dir === 'up' ? 'var(--success)' : s.dir === 'down' ? 'var(--error)' : 'var(--text-secondary)';
      const bg = s.dir === 'up' ? 'var(--success-subtle)' : s.dir === 'down' ? 'var(--error-subtle)' : 'var(--bg-overlay)';
      return (
        <div key={i} style={{
          padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg-elevated)', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, color: cls, background: bg }}>
            {icon}
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</span>
        </div>
      );
    })}
  </div>
);
