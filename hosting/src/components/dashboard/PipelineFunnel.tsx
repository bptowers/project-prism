import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import type { FunnelStage } from '@/lib/types';

interface Props { stages: FunnelStage[]; }

export const PipelineFunnel: React.FC<Props> = ({ stages }) => {
  // Math.max() of an empty list is -Infinity, which turns every bar height into NaN.
  const maxCount = Math.max(1, ...stages.map(s => s.count));
  return (
    <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Pipeline Stage Progression</span>
      </div>
      {stages.length === 0 && (
        <div style={{
          padding: '0.85rem 1rem', border: '1px dashed var(--border)', borderRadius: 8, background: 'var(--bg-elevated)',
          fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)',
        }}>
          No stage data in this report.
        </div>
      )}
      {stages.length > 0 && (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.5rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 900 }}>
          {stages.map((stage, idx) => {
            const barH = Math.max(30, (stage.count / maxCount) * 48);
            const opacity = 0.5 + (stage.count / maxCount) * 0.5;
            return (
              <React.Fragment key={stage.stage}>
                <div style={{ flex: 1, textAlign: 'center', padding: '1rem 0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>{stage.stage}</div>
                  <div style={{
                    height: barH, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: stage.color, opacity, marginBottom: '0.75rem',
                    transition: 'transform 0.15s ease',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)' }}>{stage.count}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{stage.revenue}</div>
                </div>
                {idx < stages.length - 1 && (() => {
                  const nextCount = stages[idx + 1].count;
                  if (stage.count === 0) return null;
                  const rate = Math.round((nextCount / stage.count) * 100);
                  const rateColor = rate >= 70 ? 'var(--success)' : rate >= 40 ? 'var(--warning)' : 'var(--error)';
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0, padding: '0 0.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: rateColor, fontWeight: 500, lineHeight: 1 }}>↓ {rate}%</span>
                    </div>
                  );
                })()}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      )}
    </motion.div>
  );
};
