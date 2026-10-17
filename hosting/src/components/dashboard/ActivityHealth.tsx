import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatValue } from '@/lib/format';
import { plural } from '@/lib/takeaways';
import { ACTIVITY_BUCKETS, activityBucket, type ActivityBucket } from '@/lib/dealFilters';

interface Props {
  risks: RiskDeal[];
  /** When given, each bucket is a button that drills into its deals. */
  onBucketClick?: (bucket: ActivityBucket) => void;
}

const COLOR: Record<ActivityBucket, string> = {
  active: 'var(--success)', cooling: 'var(--warning)', dormant: 'var(--error)', dark: 'var(--text-muted)',
};

export const ActivityHealth: React.FC<Props> = ({ risks, onBucketClick }) => {
  if (risks.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
        No activity data
      </div>
    );
  }

  const total = risks.length;
  const buckets = ACTIVITY_BUCKETS.map(b => {
    const deals = risks.filter(r => activityBucket(r.daysStalled) === b.key);
    return { ...b, color: COLOR[b.key], count: deals.length, pipelineValue: deals.reduce((sum, r) => sum + (r.pipelineValue ?? 0), 0) };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem' }}>
      {buckets.map(b => {
        const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
        const cardStyle: React.CSSProperties = {
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderTop: `3px solid ${b.color}`,
          borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem',
        };
        const content = (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{b.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{b.range}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>{b.count}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{pct}%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {formatValue(b.pipelineValue, b.count)}
            </div>
          </>
        );
        return onBucketClick ? (
          <button
            key={b.key}
            type="button"
            onClick={() => onBucketClick(b.key)}
            aria-label={`Show ${b.label.toLowerCase()} deals: ${plural(b.count, 'deal')}, ${pct}%`}
            style={{ ...cardStyle, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
          >
            {content}
          </button>
        ) : (
          <div key={b.key} style={cardStyle}>{content}</div>
        );
      })}
    </div>
  );
};
