import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { dimensionSignals } from '@/lib/riskSignals';

interface Props {
  deal: RiskDeal | null;
  onClose: () => void;
}

function HealthRing({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--error)';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text
          x="48" y="48" textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, fill: color }}
        >
          {score}
        </text>
      </svg>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        Health Score
      </div>
    </div>
  );
}

const SIGNAL_COLORS: Record<string, string> = {
  Engagement: 'var(--error)',
  Velocity: 'var(--warning)',
  Forecast: '#a855f7',
  Stakeholders: 'var(--accent)',
  Competition: 'var(--error)',
  Commercial: 'var(--success)',
  Process: 'var(--text-muted)',
  'Late Stage': 'var(--prism-blue)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '0.35rem',
};

const SECTION_STYLE: React.CSSProperties = {
  paddingTop: '1rem',
  paddingBottom: '1rem',
  borderTop: '1px solid var(--border)',
};

export const DealDetailModal: React.FC<Props> = ({ deal, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const signals = deal ? dimensionSignals(deal) : [];

  const levelColor = deal
    ? deal.level === 'HIGH' ? 'var(--error)' : deal.level === 'MEDIUM' ? 'var(--warning)' : 'var(--success)'
    : 'var(--text-muted)';

  return createPortal(
    <AnimatePresence>
      {deal && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              maxWidth: 580,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  background: `color-mix(in srgb, ${levelColor} 15%, transparent)`,
                  color: levelColor,
                  border: `1px solid color-mix(in srgb, ${levelColor} 35%, transparent)`,
                  letterSpacing: '0.08em',
                }}>
                  {deal.level}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {deal.value}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: '4px 8px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            {deal.accountName && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {deal.accountName}
              </div>
            )}

            {/* Health Score Ring */}
            {deal.healthScore !== undefined && (
              <div style={{ ...SECTION_STYLE, display: 'flex', justifyContent: 'center' }}>
                <HealthRing score={deal.healthScore} />
              </div>
            )}

            {/* Metadata Grid */}
            <div style={{ ...SECTION_STYLE }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Stage', value: deal.stage ?? '—' },
                  { label: 'Rep', value: deal.rep ?? '—' },
                  { label: 'Region', value: deal.region },
                  { label: 'Segment', value: deal.segment ?? '—' },
                  { label: 'Confidence', value: `${deal.confidence}%` },
                  { label: 'Days Stalled', value: `${deal.daysStalled}d` },
                  ...(deal.pipelineValue !== undefined
                    ? [{ label: 'Pipeline Value', value: formatCurrency(deal.pipelineValue) }]
                    : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={LABEL_STYLE}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Signal Tags */}
            <div style={{ ...SECTION_STYLE }}>
              <div style={LABEL_STYLE}>Risk Signals</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                {signals.map((signal) => (
                  <span
                    key={signal}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: SIGNAL_COLORS[signal] ?? 'var(--text-muted)',
                      background: `color-mix(in srgb, ${SIGNAL_COLORS[signal] ?? 'var(--text-muted)'} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${SIGNAL_COLORS[signal] ?? 'var(--text-muted)'} 30%, transparent)`,
                    }}
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>

            {/* Risk Assessment */}
            <div style={{ ...SECTION_STYLE }}>
              <div style={LABEL_STYLE}>Risk Assessment</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {deal.summary}
              </div>
            </div>

            {/* Recommended Action */}
            <div style={{ ...SECTION_STYLE, paddingBottom: 0 }}>
              <div style={LABEL_STYLE}>Recommended Action</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 700, lineHeight: 1.5 }}>
                {deal.action}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
