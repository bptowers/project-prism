import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';

interface Props {
  recordsAnalyzed?: number;
  provider?: string;
  model?: string;
  /** Already formatted for display (see formatDate). */
  generatedAt?: string;
  /** 0–100 average record quality from the validator. */
  dataQualityScore?: number;
  sourceTruncated?: boolean;
  sourceRowLimit?: number;
}

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
);

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
};

/**
 * Run metadata strip. Every value comes from the report document; anything
 * the report does not carry is simply not shown.
 */
export const ProcessingFooter: React.FC<Props> = ({
  recordsAnalyzed,
  provider,
  model,
  generatedAt,
  dataQualityScore,
  sourceTruncated,
  sourceRowLimit,
}) => {
  const items: { dot: string; text: string }[] = [];
  if (typeof recordsAnalyzed === 'number') {
    items.push({ dot: 'var(--success)', text: `${recordsAnalyzed.toLocaleString()} opportunities analyzed` });
  }
  const engine = [provider, model].filter(Boolean).join(' · ');
  if (engine) items.push({ dot: 'var(--prism-blue)', text: engine });
  if (generatedAt) items.push({ dot: 'var(--accent)', text: generatedAt });

  const hasQuality = typeof dataQualityScore === 'number' && Number.isFinite(dataQualityScore);
  const qualityPct = hasQuality ? Math.round(Math.max(0, Math.min(100, dataQualityScore))) : 0;

  const showTruncation = sourceTruncated === true;

  if (items.length === 0 && !hasQuality && !showTruncation) return null;

  return (
    <motion.div variants={itemVariants} style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '1rem 1.5rem', marginBottom: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {items.map((item, i) => (
            <span key={i} style={itemStyle}>
              <Dot color={item.dot} /> {item.text}
            </span>
          ))}
        </div>
        {hasQuality && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Data Quality</span>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={qualityPct}
              aria-label="Data quality"
              style={{ width: 120, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}
            >
              <div style={{ width: `${qualityPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--prism-green), var(--prism-amber))', borderRadius: 3 }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{qualityPct}%</span>
          </div>
        )}
      </div>
      {showTruncation && (
        <div role="alert" style={{ ...itemStyle, color: 'var(--warning)' }}>
          <Dot color="var(--warning)" />
          {typeof sourceRowLimit === 'number'
            ? `Row cap of ${sourceRowLimit.toLocaleString()} reached — some deals not included`
            : 'Source row cap reached — some deals not included'}
        </div>
      )}
    </motion.div>
  );
};
