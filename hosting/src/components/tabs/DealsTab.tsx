import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Region, RiskDeal } from '@/lib/types';
import { applyDealFilters, repName } from '@/lib/dealFilters';
import { riskScore } from '@/lib/dealMetrics';
import { regionLabel } from '@/lib/regions';
import { plural } from '@/lib/takeaways';
import { downloadDealsCsv } from '@/lib/exportCsv';
import { dealKey } from '@/lib/reviews';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { DealsLoadError } from '@/components/ui/DealsLoadError';
import { DealDetailModal } from '@/components/dashboard/DealDetailModal';
import { useReviews } from '@/components/reviews/ReviewsContext';
import { DealCard } from '@/components/deals/DealCard';
import { DealFiltersBar, type DealsTabFilters } from '@/components/deals/DealFiltersBar';
import { RepSummary } from '@/components/deals/RepSummary';

const PAGE_SIZE = 24;

// The filter fields that shape the list, in a fixed order. `filters` is the whole view (tab and
// region too) and is re-created on every hash parse, so its identity can't stand for "changed".
const FILTER_KEYS = ['rep', 'stage', 'band', 'activity', 'riskOnly', 'lateOnly', 'hideReviewed'] as const satisfies readonly (keyof DealsTabFilters)[];

interface Props {
  /** Deals in the selected region. */
  deals: RiskDeal[];
  region: Region;
  filters: DealsTabFilters;
  onFiltersChange: (patch: Partial<DealsTabFilters>) => void;
  dealsError?: string;
}

export const DealsTab: React.FC<Props> = ({ deals, region, filters, onFiltersChange, dealsError }) => {
  const reviews = useReviews();
  const [selected, setSelected] = useState<RiskDeal | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ key: string; index: number } | null>(null);

  // "Show all" applies to one list: a new region, filters or deal count starts collapsed again,
  // without an effect that would first paint the long list and then shrink it.
  const listScope = `${region}|${JSON.stringify(FILTER_KEYS.map(k => filters[k] ?? null))}|${deals.length}`;
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const showAll = expandedFor === listScope;

  const filtered = useMemo(() => applyDealFilters(deals, filters), [deals, filters]);
  const visible = useMemo(
    () => (filters.hideReviewed ? filtered.filter(d => !reviews.isDone(d)) : filtered)
      .slice()
      .sort((a, b) => riskScore(b) - riskScore(a)),
    [filtered, filters.hideReviewed, reviews],
  );
  const shown = showAll ? visible : visible.slice(0, PAGE_SIZE);
  const scope = region === 'all' ? 'all regions' : regionLabel(region);

  // A focus move belongs to the list it was queued on: if the filters change first, a card that
  // vanishes was filtered out, not reviewed away. Declared before the effect below so it runs first.
  useLayoutEffect(() => {
    pendingFocus.current = null;
  }, [listScope]);

  // With "Hide reviewed" on, reviewing a card removes it and focus would fall to <body>.
  // Once it has gone (the shared write may land a moment later), focus the card that took
  // its place, else the one before, else the list itself.
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || shown.some(d => dealKey(d) === pending.key)) return;
    pendingFocus.current = null;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return; // the user has already moved on
    const opens = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-deal-open]');
    (opens?.[pending.index] ?? opens?.[pending.index - 1] ?? listRef.current)?.focus();
  }, [shown]);

  const onReviewToggle = (deal: RiskDeal, index: number) => {
    if (filters.hideReviewed && !reviews.isDone(deal)) pendingFocus.current = { key: dealKey(deal), index };
  };

  let emptyMessage = 'No deals match these filters.';
  if (deals.length === 0) emptyMessage = dealsError ? 'Deals could not be loaded.' : 'No open deals in this view.';
  else if (filtered.length > 0 && filters.hideReviewed) emptyMessage = `All ${plural(filtered.length, 'deal')} here have been reviewed.`;

  return (
    <InsightPanel
      label="Deals"
      question="Which deals need work, and who owns them?"
      takeaway={`Showing ${plural(visible.length, 'deal')} of ${deals.length} in ${scope}, highest risk first.`}
    >
      <DealsLoadError error={dealsError} hasDeals={deals.length > 0} />
      {/* Export what is on screen: the same filters, hidden reviews and risk order as the list. */}
      <DealFiltersBar deals={deals} filters={filters} onChange={onFiltersChange} exportCount={visible.length} onExport={() => downloadDealsCsv(visible)} />
      {filters.rep && (
        <RepSummary
          rep={filters.rep}
          repDeals={deals.filter(d => repName(d) === filters.rep)}
          regionDeals={deals}
          region={region}
        />
      )}
      {/* tabIndex -1: the focus fallback when reviewing hides the last card. */}
      <div ref={listRef} role="region" aria-label="Deal list" tabIndex={-1}>
        {visible.length === 0 ? (
          <div style={{ padding: '1.25rem', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {emptyMessage}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '0.85rem' }}>
            {shown.map((deal, index) => (
              <DealCard key={`${deal.id}-${deal.value}`} deal={deal} onOpen={setSelected} onReviewToggle={d => onReviewToggle(d, index)} />
            ))}
          </div>
        )}
      </div>
      {visible.length > PAGE_SIZE && (
        <button type="button" onClick={() => setExpandedFor(showAll ? null : listScope)} style={{
          alignSelf: 'center', minHeight: 40, padding: '0 1rem', borderRadius: 6, border: '1px solid var(--border-emphasis)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer',
        }}>
          {showAll ? 'Show fewer' : `Show all ${visible.length} deals`}
        </button>
      )}
      <DealDetailModal deal={selected} onClose={() => setSelected(null)} />
    </InsightPanel>
  );
};
