import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';

interface Props {
  title: string;
}

/**
 * Compact stand-in for an enrichment section the backend did not produce for
 * this run. Mirrors the section header styling so the page keeps its shape and
 * the reader can see the phase was skipped rather than silently missing.
 */
export const NotGeneratedPanel: React.FC<Props> = ({ title }) => (
  <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        {title}
      </h3>
    </div>
    <div style={{
      padding: '0.85rem 1rem',
      border: '1px dashed var(--border)',
      borderRadius: 8,
      background: 'var(--bg-elevated)',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      color: 'var(--text-muted)',
    }}>
      Not generated for this run
    </div>
  </motion.div>
);
