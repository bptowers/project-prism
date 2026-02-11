import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
);

export const ProcessingFooter: React.FC = () => (
  <motion.div variants={itemVariants} style={{
    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '1rem 1.5rem', marginBottom: '1.5rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      {[
        { dot: 'var(--success)', text: '347 opportunities analyzed' },
        { dot: 'var(--prism-blue)', text: 'Claude Opus 4 · 42s processing' },
        { dot: 'var(--accent)', text: 'Feb 3, 2026 at 06:00 UTC' },
      ].map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          <Dot color={item.dot} /> {item.text}
        </span>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Data Quality</span>
      <div style={{ width: 120, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: '87%', height: '100%', background: 'linear-gradient(90deg, var(--prism-green), var(--prism-amber))', borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>87%</span>
    </div>
  </motion.div>
);
