import React, { useMemo } from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency, isLateStage, normalizeStage } from '@/lib/format';
import { dealValue, riskBand, riskScore } from '@/lib/dealMetrics';
import { repName } from '@/lib/dealFilters';
import { regionLabel } from '@/lib/regions';
import { queueTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { ReviewButton } from '@/components/reviews/ReviewButton';
import { useReviews } from '@/components/reviews/ReviewsContext';
import { BAND_NAME, BAND_TEXT, linkButton } from '@/components/ui/tone';

interface Props {
  deals: RiskDeal[];
  onOpenDeal: (deal: RiskDeal) => void;
  onSeeAll: () => void;
}

/** The five riskiest late-stage deals: a short daily work queue with shared review ticks. */
export const ReviewQueue: React.FC<Props> = ({ deals, onOpenDeal, onSeeAll }) => {
  const reviews = useReviews();
  const queue = useMemo(
    () => deals
      .filter(d => isLateStage(d.stage))
      .sort((a, b) => riskScore(b) - riskScore(a) || dealValue(b) - dealValue(a))
      .slice(0, 5),
    [deals],
  );
  const doneCount = queue.filter(reviews.isDone).length;
  const pct = queue.length ? Math.round((doneCount / queue.length) * 100) : 0;

  return (
    <InsightPanel
      label={`Today's queue · ${doneCount} of ${queue.length} reviewed`}
      question="Which late-stage deals could slip?"
      takeaway={queueTakeaway(queue, reviews.isDone)}
      action={<button type="button" onClick={onSeeAll} style={linkButton}>See all late-stage deals →</button>}
    >
      {queue.length > 0 && (
        <div role="progressbar" aria-label="Queue reviewed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          style={{ height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--success)' }} />
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {queue.map(deal => {
          const band = riskBand(deal);
          const isDone = reviews.isDone(deal);
          return (
            <li key={`${deal.id}-${deal.value}`} style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem',
              padding: '0.6rem 0.25rem', borderTop: '1px solid var(--border)', opacity: isDone ? 0.6 : 1,
            }}>
              <button type="button" onClick={() => onOpenDeal(deal)} style={{
                flex: '2 1 220px', textAlign: 'left', background: 'none', border: 'none', padding: 0, minHeight: 36,
                fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer',
                textDecoration: 'underline', textDecorationColor: 'var(--border-emphasis)', textUnderlineOffset: 3,
              }}>
                {deal.value}
              </button>
              <span style={{ flex: '2 1 200px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {regionLabel(deal.region)} · {repName(deal)} · {normalizeStage(deal.stage)}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{deal.daysStalled}d quiet</span>
              <span style={{ flex: '0 0 70px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(dealValue(deal))}</span>
              <span style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: BAND_TEXT[band] }}>
                {BAND_NAME[band]} · {riskScore(deal)}
              </span>
              <ReviewButton deal={deal} />
            </li>
          );
        })}
      </ul>
    </InsightPanel>
  );
};
