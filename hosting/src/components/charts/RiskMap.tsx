import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { dealValue, riskBand, riskScore, weightedValue, type RiskBand } from '@/lib/dealMetrics';

const MAX_BUBBLES = 40;
const MAX_DAYS = 60;
const WIDTH = 760;
const HEIGHT = 300;
// top >= the largest bubble radius (18), so a risk-100 bubble isn't clipped by the viewBox.
const PAD = { left: 44, right: 16, top: 20, bottom: 44 };

const BAND_COLOR: Record<RiskBand, string> = { Red: 'var(--prism-red)', Yellow: 'var(--prism-amber)', Green: 'var(--prism-green)' };
const BAND_LABEL: Record<RiskBand, string> = { Red: 'High risk', Yellow: 'Medium', Green: 'Low' };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

interface Props {
  risks: RiskDeal[];
  onDealClick?: (deal: RiskDeal) => void;
}

/** Where is the risk? x = days since activity, y = risk score, bubble = deal value. */
export const RiskMap: React.FC<Props> = ({ risks, onDealClick }) => {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (days: number) => PAD.left + (clamp(days, 0, MAX_DAYS) / MAX_DAYS) * plotW;
  const y = (score: number) => PAD.top + plotH - (score / 100) * plotH;

  // Largest deals matter most to leadership; cap so the chart stays readable.
  const plotted = risks.length > MAX_BUBBLES
    ? [...risks].sort((a, b) => dealValue(b) - dealValue(a)).slice(0, MAX_BUBBLES)
    : risks;
  const maxValue = Math.max(...plotted.map(weightedValue), 1);
  // Draw big bubbles first so small ones stay clickable on top.
  const points = [...plotted]
    .sort((a, b) => weightedValue(b) - weightedValue(a))
    .map(risk => ({
      risk,
      score: riskScore(risk),
      band: riskBand(risk),
      r: clamp(5 + Math.sqrt(weightedValue(risk) / maxValue) * 13, 6, 18),
    }));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Risk map of ${plotted.length} deals`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x={x(21)} y={y(100)} width={x(MAX_DAYS) - x(21)} height={y(70) - y(100)} fill="var(--error-subtle)" />
        <text x={x(MAX_DAYS) - 6} y={y(100) + 14} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--error-text)">
          Danger zone: high risk, quiet 3+ weeks
        </text>
        {[0, 25, 50, 75, 100].map(tick => (
          <g key={`y${tick}`}>
            <line x1={PAD.left} y1={y(tick)} x2={WIDTH - PAD.right} y2={y(tick)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{tick}</text>
          </g>
        ))}
        {[0, 15, 30, 45, 60].map(tick => (
          <text key={`x${tick}`} x={x(tick)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {tick === MAX_DAYS ? '60d+' : `${tick}d`}
          </text>
        ))}
        <text x={PAD.left + plotW / 2} y={HEIGHT - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">Days since last activity</text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle" fontSize="11" fill="var(--text-secondary)" transform={`rotate(-90 12 ${PAD.top + plotH / 2})`}>Risk score</text>
        {points.map(({ risk, score, band, r }, i) => {
          const label = `${risk.value}: ${formatCurrency(dealValue(risk))}, risk ${score}, ${risk.daysStalled} days since activity`;
          return (
            <circle
              key={`${risk.id}-${i}`}
              cx={x(risk.daysStalled)}
              cy={y(score)}
              r={r}
              fill={BAND_COLOR[band]}
              fillOpacity={0.8}
              stroke="var(--bg-surface)"
              strokeWidth={2}
              role={onDealClick ? 'button' : undefined}
              tabIndex={onDealClick ? 0 : undefined}
              aria-label={label}
              style={{ cursor: onDealClick ? 'pointer' : 'default' }}
              onClick={() => onDealClick?.(risk)}
              onKeyDown={(e) => {
                if (onDealClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onDealClick(risk);
                }
              }}
            >
              <title>{label}</title>
            </circle>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {(['Red', 'Yellow', 'Green'] as RiskBand[]).map(band => (
          <span key={band} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: BAND_COLOR[band] }} />
            {BAND_LABEL[band]}
          </span>
        ))}
        <span style={{ color: 'var(--text-muted)' }}>Bubble size = deal value{onDealClick ? ' · click a bubble to open the deal' : ''}</span>
        {risks.length > MAX_BUBBLES && (
          <span style={{ color: 'var(--text-muted)' }}>Showing the {MAX_BUBBLES} largest of {risks.length} deals</span>
        )}
      </div>
    </div>
  );
};
