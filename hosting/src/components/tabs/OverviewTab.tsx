import React, { useMemo, useState } from 'react';
import type { DeltaIntelligenceData, Region, RiskDeal } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { buildRiskDimensions, revenueConfidence, sumValue } from '@/lib/dealMetrics';
import { regionLabel } from '@/lib/regions';
import { driversTakeaway, riskMapTakeaway } from '@/lib/takeaways';
import { AIBriefing } from '@/components/dashboard/AIBriefing';
import { DealDetailModal } from '@/components/dashboard/DealDetailModal';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { RiskMap } from '@/components/charts/RiskMap';
import { RiskDriversRadar } from '@/components/charts/RiskDriversRadar';
import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
import { SinceLastRun } from '@/components/overview/SinceLastRun';
import { KpiTiles } from '@/components/overview/KpiTiles';
import { ReviewQueue } from '@/components/overview/ReviewQueue';
import { RegionCards } from '@/components/overview/RegionCards';

interface Props {
  /** Deals in the selected region. */
  deals: RiskDeal[];
  /** Every deal, for the region comparison cards. */
  allDeals: RiskDeal[];
  region: Region;
  briefing: React.ComponentProps<typeof AIBriefing>;
  delta?: DeltaIntelligenceData;
  dealsError?: string;
  onGoToDeals: (filters?: DealFilters) => void;
  onSelectRegion: (region: Region) => void;
  onSeeChanges: () => void;
}

/** The CRO's 30-second view: what moved, where the risk is, and today's queue. */
export const OverviewTab: React.FC<Props> = ({
  deals, allDeals, region, briefing, delta, dealsError, onGoToDeals, onSelectRegion, onSeeChanges,
}) => {
  const [selected, setSelected] = useState<RiskDeal | null>(null);
  const confidence = useMemo(() => revenueConfidence(deals), [deals]);
  const dimensions = useMemo(() => buildRiskDimensions(deals), [deals]);

  // Each section has its own boundary so one bad LLM payload (briefing, delta) never blanks the Overview.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {dealsError && (
        <div role="alert" style={{ padding: '0.6rem 0.85rem', borderRadius: 6, border: '1px solid var(--error)', background: 'var(--error-subtle)', color: 'var(--error-text)', fontSize: '0.8rem' }}>
          Could not load deals: {dealsError.replace(/\.$/, '')}. Showing the capped list embedded in the report.
        </div>
      )}
      <ErrorBoundary section="Since Last Run">
        <SinceLastRun delta={delta} region={region} onSeeChanges={onSeeChanges} />
      </ErrorBoundary>
      <ErrorBoundary section="AI Briefing">
        <AIBriefing
          {...briefing}
          collapsible
          scopeNote={region !== 'all' ? `Global briefing: covers all regions, not just ${regionLabel(region)}.` : undefined}
        />
      </ErrorBoundary>
      <ErrorBoundary section="Headline Numbers">
        <KpiTiles deals={deals} confidence={deals.length ? confidence : null} onSelect={onGoToDeals} />
      </ErrorBoundary>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ flex: '2 1 560px', minWidth: 0 }}>
          <ErrorBoundary section="Risk Map">
            <InsightPanel label="Risk map" question="Where is the risk?" takeaway={riskMapTakeaway(deals)}>
              <RiskMap risks={deals} onDealClick={setSelected} />
            </InsightPanel>
          </ErrorBoundary>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <ErrorBoundary section="Risk Drivers">
            <InsightPanel label="Risk drivers · revenue confidence" question="What's driving it?" takeaway={driversTakeaway(deals.length, confidence, dimensions)}>
              {/* With no deals the takeaway says so; a red 0/100 gauge would read as a verdict. */}
              {deals.length > 0 && (
                <>
                  <RiskDriversRadar dimensions={dimensions} valueTotal={sumValue(deals)} />
                  <ConfidenceGauge value={confidence} />
                </>
              )}
            </InsightPanel>
          </ErrorBoundary>
        </div>
      </div>
      <ErrorBoundary section="Today's Queue">
        <ReviewQueue deals={deals} onOpenDeal={setSelected} onSeeAll={() => onGoToDeals({ lateOnly: true })} />
      </ErrorBoundary>
      <ErrorBoundary section="Regions">
        <RegionCards allDeals={allDeals} region={region} onSelectRegion={onSelectRegion} />
      </ErrorBoundary>
      {/* Keyed on the deal so a crash in one deal's popup doesn't stick when another opens. */}
      <ErrorBoundary key={selected ? `${selected.id}-${selected.value}` : 'none'} section="Deal Details">
        <DealDetailModal deal={selected} onClose={() => setSelected(null)} />
      </ErrorBoundary>
    </div>
  );
};
