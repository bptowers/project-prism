import React, { useMemo, useState } from 'react';
import type { Region, RiskDeal } from '@/lib/types';
import { applyDealFilters, repName } from '@/lib/dealFilters';
import { riskScore } from '@/lib/dealMetrics';
import { regionLabel } from '@/lib/regions';
import { plural } from '@/lib/takeaways';
import { downloadDealsCsv } from '@/lib/exportCsv';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { DealDetailModal } from '@/components/dashboard/DealDetailModal';
import { useReviews } from '@/components/reviews/ReviewsContext';
import { DealCard } from '@/components/deals/DealCard';
import { DealFiltersBar, type DealsTabFilters } from '@/components/deals/DealFiltersBar';
import { RepSummary } from '@/components/deals/RepSummary';

const PAGE_SIZE = 24;

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
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<RiskDeal | null>(null);

  const filtered = useMemo(() => applyDealFilters(deals, filters), [deals, filters]);
  const visible = useMemo(
    () => (filters.hideReviewed ? filtered.filter(d => !reviews.isDone(d)) : filtered)
      .slice()
      .sort((a, b) => riskScore(b) - riskScore(a)),
    [filtered, filters.hideReviewed, reviews],
  );
  const shown = showAll ? visible : visible.slice(0, PAGE_SIZE);
  const scope = region === 'all' ? 'all regions' : regionLabel(region);

  let emptyMessage = 'No deals match these filters.';
  if (deals.length === 0) emptyMessage = dealsError ? 'Deals could not be loaded.' : 'No open deals in this view.';
  else if (filtered.length > 0 && filters.hideReviewed) emptyMessage = `All ${plural(filtered.length, 'deal')} here have been reviewed.`;

  return (
    <InsightPanel
      label="Deals"
      question="Which deals need work, and who owns them?"
      takeaway={`Showing ${plural(visible.length, 'deal')} of ${deals.length} in ${scope}, highest risk first.`}
    >
      {dealsError && (
        <div role="alert" style={{ padding: '0.6rem 0.85rem', borderRadius: 6, border: '1px solid var(--error)', background: 'var(--error-subtle)', color: 'var(--error-text)', fontSize: '0.8rem' }}>
          Could not load deals: {dealsError.replace(/\.$/, '')}. Showing the capped list embedded in the report.
        </div>
      )}
      {/* Export what is on screen: the same filters, hidden reviews and risk order as the list. */}
      <DealFiltersBar deals={deals} filters={filters} onChange={onFiltersChange} exportCount={visible.length} onExport={() => downloadDealsCsv(visible)} />
      {filters.rep && (
        <RepSummary
          rep={filters.rep}
          repDeals={deals.filter(d => repName(d) === filters.rep)}
          regionDeals={deals}
          regionName={region === 'all' ? 'all-regions' : regionLabel(region)}
        />
      )}
      {visible.length === 0 ? (
        <div style={{ padding: '1.25rem', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {emptyMessage}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '0.85rem' }}>
          {shown.map(deal => <DealCard key={`${deal.id}-${deal.value}`} deal={deal} onOpen={setSelected} />)}
        </div>
      )}
      {visible.length > PAGE_SIZE && (
        <button type="button" onClick={() => setShowAll(s => !s)} style={{
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
