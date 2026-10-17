import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useReviews } from './ReviewsContext';

/** Shared "Mark reviewed" toggle. Stops click/Enter/Space propagation so it can sit inside a clickable card. */
export const ReviewButton: React.FC<{ deal: RiskDeal; onToggle?: (deal: RiskDeal) => void }> = ({ deal, onToggle }) => {
  const reviews = useReviews();
  const review = reviews.getReview(deal);
  const done = reviews.isDone(deal);
  const worse = reviews.isWorse(deal);
  const label = done ? 'Reviewed' : worse ? 'Review again' : 'Mark reviewed';
  const reviewedOn = review?.reviewedAt ? ` · ${formatDate(review.reviewedAt.toISOString())}` : '';

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <button
        type="button"
        aria-pressed={done}
        aria-label={`${label}: ${deal.value}`}
        onClick={(e) => { e.stopPropagation(); onToggle?.(deal); reviews.toggle(deal); }}
        // Keep the button's own activation keys from reaching a card; let Escape etc. through to modals.
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
        style={{
          minHeight: 32,
          padding: '0 0.7rem',
          borderRadius: 6,
          border: `1px solid ${done ? 'var(--success)' : worse ? 'var(--warning)' : 'var(--border-emphasis)'}`,
          background: done ? 'var(--success-subtle)' : 'var(--bg-surface)',
          color: done ? 'var(--success-text)' : 'var(--text-primary)',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {done ? '✓ Reviewed' : label}
      </button>
      {worse && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--warning-text)' }}>Worse since review</span>}
      {done && review && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{review.reviewedByName}{reviewedOn}</span>
      )}
    </span>
  );
};
