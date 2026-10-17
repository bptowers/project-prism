import React from 'react';
import type { Region, RiskDeal, TQDealRow, TwentyQuestionsData } from '@/lib/types';
import { asArray, isRecord } from '@/lib/guards';
import { formatDate } from '@/lib/format';
import { normalizeRegionKey, regionLabel } from '@/lib/regions';
import { interventionsTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';
import { ReviewButton } from '@/components/reviews/ReviewButton';
import { useReviews } from '@/components/reviews/ReviewsContext';

// LLM rows are unvalidated, so a name may not be a string.
const norm = (s?: unknown) => String(s ?? '').trim().toLowerCase();

interface Props {
  data?: TwentyQuestionsData;
  region: Region;
  /** Report deals, used to attach a shared review to each AI-named deal. */
  deals: RiskDeal[];
  isLive?: boolean;
}

/** CRO question 10: the deals that need the CRO personally. */
export const Interventions: React.FC<Props> = ({ data, region, deals, isLive }) => {
  const reviews = useReviews();
  const q10 = data?.question10;
  if (!isRecord(q10)) return isLive ? <NotGeneratedPanel title="Needs your intervention" /> : null;

  const rows = asArray<unknown>(q10.deals)
    .filter((r): r is TQDealRow => isRecord(r))
    .filter(r => region === 'all' || normalizeRegionKey(String(r.region ?? '')) === region);
  // The AI names deals rather than citing ids, so a review attaches only when the name matches a report deal.
  const matched = rows.map(row => ({
    row,
    deal: norm(row.name)
      ? deals.find(d => norm(d.value) === norm(row.name) || (!!d.accountName && norm(d.accountName) === norm(row.name)))
      : undefined,
  }));
  const done = matched.filter(m => m.deal && reviews.isDone(m.deal)).length;

  return (
    <InsightPanel
      label={rows.length ? `Needs your intervention · ${done} of ${rows.length} reviewed` : 'Needs your intervention'}
      question="Which deals need the CRO personally?"
      takeaway={interventionsTakeaway(rows)}
      note={region !== 'all' ? `The AI picked these from all regions; showing the ones in ${regionLabel(region)}.` : undefined}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {matched.map(({ row, deal }, i) => (
          <li key={`${norm(row.name)}-${i}`} style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem', padding: '0.7rem 0.25rem',
            borderTop: '1px solid var(--border)', opacity: deal && reviews.isDone(deal) ? 0.6 : 1,
          }}>
            <div style={{ flex: '2 1 240px', minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{row.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {[row.rep, row.region && regionLabel(row.region), row.stage, row.mrr].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ flex: '3 1 280px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{row.croAction || row.urgencySignal || '—'}</div>
            {row.deadline && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning-text)' }}>by {formatDate(row.deadline)}</div>}
            {deal && <ReviewButton deal={deal} />}
          </li>
        ))}
      </ul>
    </InsightPanel>
  );
};
