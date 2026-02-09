import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import type { Region } from '@/lib/types';

const tabs: { region: Region; label: string; count: string; revenue: string }[] = [
  { region: 'all', label: 'All Regions', count: '347', revenue: '$47.2M' },
  { region: 'na', label: 'NA', count: '187', revenue: '$26.1M' },
  { region: 'uk', label: 'UK', count: '94', revenue: '$13.4M' },
  { region: 'anz', label: 'ANZ', count: '66', revenue: '$7.7M' },
];

interface Props {
  region: Region;
  onSelect: (r: Region) => void;
}

export const RegionTabs: React.FC<Props> = ({ region, onSelect }) => (
  <motion.div variants={itemVariants} style={{
    display: 'flex', gap: '0.25rem', marginBottom: '2rem',
    borderBottom: '1px solid var(--border)',
  }}>
    {tabs.map(tab => (
      <button key={tab.region} onClick={() => onSelect(tab.region)} style={{
        padding: '0.75rem 1.5rem', background: 'none', border: 'none',
        color: region === tab.region ? 'var(--text-primary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
        borderBottom: region === tab.region ? '2px solid var(--accent)' : '2px solid transparent',
        position: 'relative', bottom: -1,
        ...(region === tab.region && {
          borderImage: 'linear-gradient(to right, var(--prism-blue), var(--prism-green), var(--prism-amber), var(--prism-red)) 1',
        }),
      }}>
        {tab.label}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({tab.count})</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginLeft: '0.25rem' }}>{tab.revenue}</span>
      </button>
    ))}
  </motion.div>
);
