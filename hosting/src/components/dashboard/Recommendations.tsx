import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import type { Recommendation } from '@/lib/types';

const priorityStyles: Record<string, React.CSSProperties> = {
  P1: { background: 'var(--error-subtle)', color: 'var(--error)' },
  P2: { background: 'var(--accent-subtle)', color: 'var(--accent)' },
  P3: { background: 'var(--success-subtle)', color: 'var(--success)' },
};

interface Props { items: Recommendation[]; }

export const Recommendations: React.FC<Props> = ({ items }) => (
  <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>AI Recommended Actions</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prioritized by revenue impact</span>
    </div>
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {items.map((r, i) => (
        <div key={i} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '1.25rem', display: 'grid', gridTemplateColumns: 'auto 1fr auto',
          gap: '1rem', alignItems: 'center',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, ...priorityStyles[r.priority],
          }}>{r.priority}</div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.desc}</div>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--success)',
            background: 'var(--success-subtle)', padding: '3px 10px', borderRadius: 4, whiteSpace: 'nowrap', fontWeight: 500,
          }}>{r.impact}</span>
        </div>
      ))}
    </div>
  </motion.div>
);
