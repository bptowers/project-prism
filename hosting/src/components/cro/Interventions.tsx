import React from 'react';
import type { Region, RiskDeal, TQDealRow, TwentyQuestionsData } from '@/lib/types';
import { asArray, isRecord, text } from '@/lib/guards';
import { formatDate } from '@/lib/format';
import { dealKey } from '@/lib/reviews';
import { normalizeRegionKey, regionLabel } from '@/lib/regions';
import { interventionsTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';
import { ReviewButton } from '@/components/reviews/ReviewButton';
import { useReviews } from '@/components/reviews/ReviewsContext';

const norm = (s: unknown) => text(s).trim().toLowerCase();

/**
 * The AI names deals rather than citing ids. An exact deal name wins; an account name
 * counts only when it picks out a single deal, so a review never lands on the wrong one.
 */
function matchDeal(name: unknown, deals: RiskDeal[]): RiskDeal | undefined {
  const key = norm(name);
  if (!key) return undefined;
  const byName = deals.find(d => norm(d.value) === key);
  if (byName) return byName;
  const byAccount = deals.filter(d => norm(d.accountName) === key);
  return byAccount.length === 1 ? byAccount[0] : undefined;
}

const muted: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' };

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
    .filter(r => region === 'all' || normalizeRegionKey(text(r.region)) === region);
  // The AI can name one deal twice: only its first row carries the review control, and it counts once.
  const seen = new Set<string>();
  const matched = rows.map(row => {
    const deal = matchDeal(row.name, deals);
    const key = deal ? dealKey(deal) : '';
    const duplicate = !!deal && seen.has(key);
    if (deal) seen.add(key);
    return { row, deal, duplicate };
  });
  const distinct = matched.filter(m => m.deal && !m.duplicate).map(m => m.deal as RiskDeal);
  // The takeaway counts each deal once: by report deal when matched, else by the AI's normalised name.
  const named = new Set<string>();
  const takeawayRows = matched.filter(({ row, deal }, i) => {
    const id = deal ? `deal:${dealKey(deal)}` : norm(row.name) ? `name:${norm(row.name)}` : `row:${i}`;
    if (named.has(id)) return false;
    named.add(id);
    return true;
  }).map(m => m.row);
  const done = distinct.filter(d => reviews.isDone(d)).length;
  const unmatched = matched.filter(m => !m.deal).length;
  const label = [
    'Needs your intervention',
    distinct.length ? `${done} of ${distinct.length} reviewed` : '',
    unmatched ? `${unmatched} not in deal list` : '',
  ].filter(Boolean).join(' · ');

  return (
    <InsightPanel
      label={label}
      question="Which deals need the CRO personally?"
      takeaway={interventionsTakeaway(takeawayRows)}
      note={region !== 'all' ? `The AI picked these from all regions; showing the ones in ${regionLabel(region)}.` : undefined}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {matched.map(({ row, deal, duplicate }, i) => {
          const regionText = text(row.region);
          const deadline = text(row.deadline);
          const formatted = formatDate(deadline);
          return (
            <li key={`${norm(row.name)}-${i}`} style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem', padding: '0.7rem 0.25rem',
              borderTop: '1px solid var(--border)', opacity: deal && reviews.isDone(deal) ? 0.6 : 1,
            }}>
              <div style={{ flex: '2 1 240px', minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{text(row.name)}</div>
                <div style={muted}>
                  {[text(row.rep), regionText && regionLabel(regionText), text(row.stage), text(row.mrr)].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ flex: '3 1 280px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{text(row.croAction) || text(row.urgencySignal) || '—'}</div>
              {/* "by" only for a real date; the AI also writes deadlines like "48 hours". */}
              {deadline && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning-text)' }}>{formatted !== deadline ? `by ${formatted}` : deadline}</div>}
              {!deal ? <span style={muted}>Not in this report's deal list</span>
                : duplicate ? <span style={muted}>Same deal as above</span>
                : <ReviewButton deal={deal} />}
            </li>
          );
        })}
      </ul>
    </InsightPanel>
  );
};
