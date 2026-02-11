import React from 'react';
import type { ThemeItem } from '@/lib/types';

interface Props { themes: ThemeItem[]; type: 'win' | 'loss'; }

export const ThemeChart: React.FC<Props> = ({ themes, type }) => (
  <div>
    {themes.map(t => (
      <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ minWidth: 160, fontSize: '0.875rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{t.label}</span>
        <div style={{ flex: 1, background: 'var(--bg-elevated)', height: 22, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${t.pct}%`, height: '100%', borderRadius: 4,
            background: type === 'win'
              ? 'linear-gradient(90deg, var(--prism-green), rgba(126,181,99,0.7))'
              : 'linear-gradient(90deg, var(--prism-amber), var(--prism-red))',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '0.5rem',
            transition: 'width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{t.pct}%</span>
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{t.revenue}</span>
      </div>
    ))}
  </div>
);
