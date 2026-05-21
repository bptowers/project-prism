import { motion } from 'framer-motion';
import React from 'react';
import { itemVariants, cardHover } from '@/theme/animations';

type AccentColor = 'green' | 'red' | 'amber' | 'blue';

const accentGradients: Record<AccentColor, string> = {
  green: 'linear-gradient(to right, var(--prism-green) 0%, transparent 100%)',
  red: 'linear-gradient(to right, var(--prism-red) 0%, transparent 100%)',
  amber: 'linear-gradient(to right, var(--prism-amber) 0%, transparent 100%)',
  blue: 'linear-gradient(to right, var(--prism-blue) 0%, transparent 100%)',
};

interface PanelProps {
  title: string;
  accent: AccentColor;
  meta?: string;
  maxHeight?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, accent, meta, maxHeight = '420px', children }) => (
  <motion.div
    variants={itemVariants}
    whileHover={cardHover}
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
    }}
  >
    <div style={{
      padding: '1.25rem 1.5rem',
      borderBottom: '1px solid var(--border)',
      position: 'relative',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>{title}</h2>
      {meta && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{meta}</span>}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: accentGradients[accent],
      }} />
    </div>
    <div style={{
      padding: '1.25rem 1.5rem',
      flex: 1,
      overflowY: 'auto',
      maxHeight,
    }}>
      {children}
    </div>
  </motion.div>
);
