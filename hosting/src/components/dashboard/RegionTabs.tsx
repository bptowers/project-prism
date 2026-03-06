import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import type { Region } from '@/lib/types';

// Sample/fallback tab metadata (counts/revenue shown when no live data)
const TAB_CONFIG: { region: Region; label: string; sampleCount: string; sampleRevenue: string }[] = [
  { region: 'all',  label: 'All Regions',   sampleCount: '347', sampleRevenue: '$47.2M' },
  { region: 'na',   label: 'North America', sampleCount: '187', sampleRevenue: '$26.1M' },
  { region: 'uk',   label: 'UK',            sampleCount: '94',  sampleRevenue: '$13.4M' },
  { region: 'au',   label: 'Australia',     sampleCount: '42',  sampleRevenue: '$5.2M'  },
  { region: 'nz',   label: 'New Zealand',   sampleCount: '24',  sampleRevenue: '$2.5M'  },
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
      const liveCount = isLive && regionCounts?.[tab.region];
      const displayCount = liveCount != null ? `${liveCount}` : tab.sampleCount;
      // For "all" tab live count, sum all known region counts
      const allLiveCount = isLive && regionCounts
        ? Object.values(regionCounts).reduce((s, v) => s + v, 0)
        : null;
      const countDisplay = tab.region === 'all' && allLiveCount != null
        ? `${allLiveCount}`
        : displayCount;

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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
            ({countDisplay})
          </span>
          {!isLive && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginLeft: '0.25rem' }}>
              {tab.sampleRevenue}
            </span>
          )}
        </button>
      );
    })}
  </motion.div>
);
