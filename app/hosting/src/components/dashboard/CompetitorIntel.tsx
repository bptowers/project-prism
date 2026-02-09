import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants, cardHover } from '@/theme/animations';
import { Badge } from '@/components/ui/Badge';
import type { Competitor } from '@/lib/types';

interface Props { competitors: Competitor[]; }

export const CompetitorIntel: React.FC<Props> = ({ competitors }) => (
  <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Competitor Intelligence</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Win/Loss record | FUD tactics</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
      {competitors.map(c => (
        <motion.div key={c.name} whileHover={cardHover} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>{c.name}</span>
            <Badge variant={c.threat === 'high' ? 'high' : c.threat === 'medium' ? 'medium' : 'low'}>{c.threat.toUpperCase()}</Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { val: c.wins, label: 'Wins', color: 'var(--success)' },
              { val: c.losses, label: 'Losses', color: 'var(--error)' },
              { val: c.pending, label: 'Active', color: 'var(--text-primary)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 500, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 5, padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Primary FUD Detected</div>
            {c.fud}
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
);
