import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import { Sparkline } from '@/components/ui/Sparkline';
import type { Stats } from '@/lib/types';

function getStatColor(key: string, value: string): string | null {
  if (value === '—' || value === '' || value == null) return null;

  if (key === 'avgHealthScore') {
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    if (num >= 70) return 'var(--success)';
    if (num >= 40) return 'var(--warning)';
    return 'var(--error)';
  }

  if (key === 'dealsAtRisk') {
    const num = parseFloat(value.replace('%', ''));
    if (isNaN(num)) return null;
    if (num < 25) return 'var(--success)';
    if (num < 50) return 'var(--warning)';
    return 'var(--error)';
  }

  if (key === 'atRisk') {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return null;
    if (num === 0) return 'var(--success)';
    if (num <= 5) return 'var(--warning)';
    return 'var(--error)';
  }

  return null;
}

const statConfig: Record<string, { label: string; borderColor: string; sparkColor: string; valueColor?: string }> = {
  pipeline:       { label: 'Pipeline Value',      borderColor: 'var(--accent)',      sparkColor: 'var(--accent)' },
  avgHealthScore: { label: 'Avg Health Score',    borderColor: 'var(--success)',     sparkColor: 'var(--success)',  valueColor: 'var(--success)' },
  atRisk:         { label: 'Revenue at Risk',     borderColor: 'var(--error)',       sparkColor: 'var(--error)',    valueColor: 'var(--error)' },
  dealsAtRisk:    { label: 'Deals at Risk',       borderColor: 'var(--error)',       sparkColor: 'var(--error)',    valueColor: 'var(--error)' },
  forecast:       { label: 'Forecast Confidence', borderColor: 'var(--accent)',      sparkColor: 'var(--accent)' },
  velocity:       { label: 'Avg Days Stalled',     borderColor: 'var(--prism-blue)',  sparkColor: 'var(--prism-blue)' },
};

const CLICKABLE_KEYS = new Set(['atRisk', 'dealsAtRisk']);

interface Props {
  stats: Stats;
  sparklines: Record<string, number[]>;
  onStatClick?: (key: string) => void;
}

export const StatsRow: React.FC<Props> = ({ stats, sparklines, onStatClick }) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
      {(['pipeline', 'avgHealthScore', 'atRisk', 'dealsAtRisk', 'forecast', 'velocity'] as Array<keyof typeof statConfig>).map(key => {
        const stat = stats[key as keyof typeof stats];
        if (!stat) return null;
        const cfg = statConfig[key];
        const dynamicColor = getStatColor(key, stat.value ?? '');
        const effectiveColor = dynamicColor ?? cfg.borderColor;
        const effectiveValueColor = dynamicColor ?? cfg.valueColor;
        const isNegativeMetric = key === 'atRisk' || key === 'dealsAtRisk';
        const changeClass = (stat.dir === 'up' && !isNegativeMetric) || (stat.dir === 'down' && isNegativeMetric) ? 'good' : 'bad';
        const isClickable = CLICKABLE_KEYS.has(key);
        const isHovered = hoveredKey === key;
        return (
          <motion.div
            key={key}
            variants={itemVariants}
            whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
            onClick={isClickable ? () => onStatClick?.(key) : undefined}
            onMouseEnter={isClickable ? () => setHoveredKey(key) : undefined}
            onMouseLeave={isClickable ? () => setHoveredKey(null) : undefined}
            style={{
              background: 'var(--bg-surface)',
              border: isHovered ? `1px solid ${effectiveColor}` : '1px solid var(--border)',
              borderRadius: 8,
              padding: '1.25rem',
              borderTop: `3px solid ${effectiveColor}`,
              overflow: 'hidden',
              cursor: isClickable ? 'pointer' : undefined,
              transition: 'border-color 0.15s ease',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
              {cfg.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.875rem', fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 1, color: effectiveValueColor || 'var(--text-primary)' }}>
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: isClickable ? '0.25rem' : '0.75rem' }}>{stat.sub}</div>
            {isClickable && (
              <div style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.15s ease',
                userSelect: 'none',
              }}>
                ↓ Jump to Risk Radar
              </div>
            )}
            {sparklines[key] && <Sparkline data={sparklines[key]} color={effectiveColor} />}
          </motion.div>
        );
      })}
    </div>
  );
};
