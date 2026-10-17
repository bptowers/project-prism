import type React from 'react';
import type { RiskBand } from '@/lib/dealMetrics';

/** Readable text colours on cards, defined for both themes in global.css. */
export const BAND_TEXT: Record<RiskBand, string> = { Red: 'var(--error-text)', Yellow: 'var(--warning-text)', Green: 'var(--success-text)' };
export const BAND_NAME: Record<RiskBand, string> = { Red: 'High', Yellow: 'Medium', Green: 'Low' };

export function scoreTextColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 70) return 'var(--success-text)';
  if (score >= 40) return 'var(--warning-text)';
  return 'var(--error-text)';
}

export const linkButton: React.CSSProperties = {
  minHeight: 40, padding: '0 0.25rem', background: 'none', border: 'none',
  color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
};

export const smallCaps: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
};
