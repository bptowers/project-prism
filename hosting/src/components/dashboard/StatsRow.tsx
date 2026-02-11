import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import { Sparkline } from '@/components/ui/Sparkline';
import type { Stats } from '@/lib/types';

const statConfig: Record<string, { label: string; borderColor: string; sparkColor: string; valueColor?: string }> = {
  pipeline: { label: 'Pipeline Value', borderColor: 'var(--accent)', sparkColor: '#d4a574' },
  winRate: { label: 'Win Rate', borderColor: 'var(--success)', sparkColor: '#7eb563', valueColor: 'var(--success)' },
  atRisk: { label: 'Revenue at Risk', borderColor: 'var(--error)', sparkColor: '#c75d5d', valueColor: 'var(--error)' },
  velocity: { label: 'Deal Velocity', borderColor: 'var(--prism-blue)', sparkColor: '#6ba3c7' },
  forecast: { label: 'Forecast Confidence', borderColor: 'var(--accent)', sparkColor: '#d4a574' },
  threats: { label: 'Active Threats', borderColor: 'var(--error)', sparkColor: '#c75d5d', valueColor: 'var(--error)' },
};

interface Props {
  stats: Stats;
  sparklines: Record<string, number[]>;
}

export const StatsRow: React.FC<Props> = ({ stats, sparklines }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
    {Object.entries(stats).map(([key, stat]) => {
      const cfg = statConfig[key];
      const isNegativeMetric = key === 'atRisk' || key === 'threats';
      const changeClass = (stat.dir === 'up' && !isNegativeMetric) || (stat.dir === 'down' && isNegativeMetric) ? 'good' : 'bad';
      return (
        <motion.div key={key} variants={itemVariants} whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '1.25rem', borderTop: `3px solid ${cfg.borderColor}`, overflow: 'hidden',
          }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            {cfg.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.875rem', fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 1, color: cfg.valueColor || 'var(--text-primary)' }}>
              {stat.value}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3,
              color: changeClass === 'good' ? 'var(--success)' : 'var(--error)',
              background: changeClass === 'good' ? 'var(--success-subtle)' : 'var(--error-subtle)',
            }}>
              {stat.change}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{stat.sub}</div>
          {sparklines[key] && <Sparkline data={sparklines[key]} color={cfg.sparkColor} />}
        </motion.div>
      );
    })}
  </div>
);
