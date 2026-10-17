import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatValue, normalizeStage } from '@/lib/format';
import { dealValue, riskBand, riskScore } from '@/lib/dealMetrics';
import { repName } from '@/lib/dealFilters';
import { regionLabel } from '@/lib/regions';
import { Badge } from '@/components/ui/Badge';
import { ReviewButton } from '@/components/reviews/ReviewButton';
import { useReviews } from '@/components/reviews/ReviewsContext';
import { BAND_NAME, BAND_TEXT } from '@/components/ui/tone';

const meta: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' };

/**
 * The card itself is not interactive: the deal name is the button that opens the
 * deal, and Review sits beside it, so no control is nested inside another (some
 * screen readers skip a button inside a role=button). A click anywhere else on the
 * card also opens it, for mouse users only; it adds no tab stop or role.
 */
interface Props {
  deal: RiskDeal;
  onOpen: (deal: RiskDeal) => void;
  /** Called just before the review toggles, e.g. so the list can place focus if the card disappears. */
  onReviewToggle?: (deal: RiskDeal) => void;
}

export const DealCard: React.FC<Props> = ({ deal, onOpen, onReviewToggle }) => {
  const reviews = useReviews();
  const band = riskBand(deal);
  return (
    <article
      aria-label={deal.value}
      onClick={() => {
        // Releasing a drag that selected text (to copy a name or summary) is not a request to open.
        if (window.getSelection()?.toString()) return;
        onOpen(deal);
      }}
      style={{
        textAlign: 'left', padding: '1rem', border: '1px solid var(--border)', borderRadius: 8,
        background: 'var(--bg-surface)', cursor: 'pointer', opacity: reviews.isDone(deal) ? 0.65 : 1,
        display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4, flexWrap: 'wrap', overflowWrap: 'anywhere' }}>
            <Badge variant={band === 'Red' ? 'high' : band === 'Yellow' ? 'medium' : 'low'}>{BAND_NAME[band]}</Badge>
            <span style={meta}>{regionLabel(deal.region)}</span>
            <span style={meta}>{normalizeStage(deal.stage)}</span>
            <span style={meta}>{repName(deal)}</span>
          </div>
          <h3 style={{ margin: 0, minWidth: 0 }}>
            <button
              type="button"
              aria-label={`Open ${deal.value}`}
              data-deal-open
              title={deal.value}
              onClick={(e) => { e.stopPropagation(); onOpen(deal); }}
              style={{
                display: 'block', maxWidth: '100%', minHeight: 28, padding: 0, border: 'none', background: 'none',
                color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.92rem', textAlign: 'left', cursor: 'pointer',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {deal.value}
            </button>
          </h3>
          <div style={{ ...meta, overflowWrap: 'anywhere' }}>{formatValue(dealValue(deal), 1)} · {deal.daysStalled}d since activity</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexShrink: 0 }}>
          <ReviewButton deal={deal} onToggle={onReviewToggle} />
          <div style={{ textAlign: 'right' }}>
            <div style={meta}>Risk</div>
            <div style={{ fontWeight: 850, color: BAND_TEXT[band] }}>{riskScore(deal)}</div>
          </div>
        </div>
      </div>
      {deal.summary && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{deal.summary}</div>}
    </article>
  );
};
