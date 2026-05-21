import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import type { Region } from '@/lib/types';

const TAB_CONFIG: { region: Region; label: string }[] = [
  { region: 'all', label: 'All Regions' },
  { region: 'na',  label: 'North America' },
  { region: 'uk',  label: 'UK' },
  { region: 'au',  label: 'AU / NZ' },
];

interface Props {
  region: Region;
  onSelect: (r: Region) => void;
  /** Live opportunity counts per region key (when live Firestore data is loaded) */
  regionCounts?: Record<string, number>;
  isLive?: boolean;
}

export const RegionTabs: React.FC<Props> = ({ region, onSelect, regionCounts, isLive }) => (
  <motion.div variants={itemVariants} style={{
    display: 'flex', gap: '0.25rem', marginBottom: '2rem',
    borderBottom: '1px solid var(--border)',
  }}>
    {TAB_CONFIG.map(tab => {
      const allLiveCount = isLive && regionCounts
        ? Object.values(regionCounts).reduce((s, v) => s + v, 0)
        : null;
      const liveCount = tab.region === 'all'
        ? allLiveCount
        : (isLive && regionCounts ? regionCounts[tab.region] : undefined);

      return (
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
          {liveCount != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              ({liveCount})
            </span>
          )}
        </button>
      );
    })}
  </motion.div>
);
