import React from 'react';

/** Value-weighted revenue confidence, 0–100. The number comes from revenueConfidence() in lib/dealMetrics. */
export const ConfidenceGauge: React.FC<{ value: number }> = ({ value }) => {
  const conf = Math.max(0, Math.min(100, Math.round(value)));
  const arcColor = conf >= 70 ? 'var(--success)' : conf >= 40 ? 'var(--warning)' : 'var(--error)';
  const cx = 80, cy = 80, r = 60;
  // Foreground arc sweeps from 180° (left) toward 0° (right) in proportion to conf.
  const angle = Math.PI - (conf / 100) * Math.PI;
  const endX = cx + r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  // A half-circle gauge never sweeps more than 180°, so large-arc is always 0.
  const fgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 160 100" role="img" aria-label={`Revenue confidence: ${conf} out of 100`} style={{ width: 150, maxWidth: '100%', display: 'block' }}>
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="var(--border)" strokeWidth={10} strokeLinecap="round" />
        {conf > 0 && <path d={fgPath} fill="none" stroke={arcColor} strokeWidth={10} strokeLinecap="round" />}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={28} fontWeight={850} fill={arcColor} fontFamily="inherit">{conf}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--text-muted)" fontFamily="inherit">/100</text>
      </svg>
      <div style={{ minWidth: 0, flex: '1 1 160px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Revenue confidence</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Weighted by deal value. Computed from deal health, not by the AI.
        </div>
      </div>
    </div>
  );
};
