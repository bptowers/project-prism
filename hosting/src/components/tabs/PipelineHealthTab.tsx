import React from 'react';
import type { FunnelStage, Region, RiskDeal, StatData } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { regionLabel } from '@/lib/regions';
import { activityTakeaway, forecastTakeaway, funnelTakeaway, repTakeaway, stageTakeaway } from '@/lib/takeaways';
import { DealsLoadError } from '@/components/ui/DealsLoadError';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { RiskByStage } from '@/components/dashboard/RiskByStage';
import { ActivityHealth } from '@/components/dashboard/ActivityHealth';
import { ForecastIntegrity } from '@/components/dashboard/ForecastIntegrity';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { RepHeatmap } from '@/components/dashboard/RepHeatmap';

interface Props {
  deals: RiskDeal[];
  funnel: FunnelStage[];
  /** The AI's forecast confidence (report stats), shown labelled as the AI's view. */
  forecastStat: StatData;
  region: Region;
  dealsError?: string;
  onGoToDeals: (filters: DealFilters) => void;
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: '1.25rem' };

/** Where is the pipeline weak, and who needs help? Every panel drills into the Deals tab. */
export const PipelineHealthTab: React.FC<Props> = ({ deals, funnel, forecastStat, region, dealsError, onGoToDeals }) => {
  // The report has one portfolio-wide AI forecast; every region's stats carry the same figure.
  const forecastScope = region !== 'all' ? ` The AI figure covers all regions, not just ${regionLabel(region)}.` : '';
  const forecastNote = `Forecast confidence here is the AI's own assessment. The Overview gauge is computed from deal health.${forecastScope}`;

  // Each panel has its own boundary so one bad payload never blanks the tab.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <DealsLoadError error={dealsError} hasDeals={deals.length > 0} />
      <div style={grid}>
        <ErrorBoundary section="Risk by Stage">
          <InsightPanel label="Risk by stage" question="Which stages are leaking?" takeaway={stageTakeaway(deals)}>
            <RiskByStage risks={deals} onStageClick={stage => onGoToDeals({ stage })} />
          </InsightPanel>
        </ErrorBoundary>
        <ErrorBoundary section="Activity Health">
          <InsightPanel label="Activity health" question="Are reps still working these deals?" takeaway={activityTakeaway(deals)}>
            <ActivityHealth risks={deals} onBucketClick={activity => onGoToDeals({ activity })} />
          </InsightPanel>
        </ErrorBoundary>
        <ErrorBoundary section="Forecast Integrity">
          <InsightPanel
            label="Forecast integrity"
            question="Does the forecast match deal reality?"
            takeaway={forecastTakeaway(deals)}
            note={forecastNote}
          >
            <ForecastIntegrity risks={deals} forecastStat={forecastStat} />
          </InsightPanel>
        </ErrorBoundary>
        <ErrorBoundary section="Pipeline Funnel">
          <InsightPanel label="Pipeline funnel" question="Is there enough pipeline coming through?" takeaway={funnelTakeaway(funnel)}>
            <PipelineFunnel stages={funnel} />
          </InsightPanel>
        </ErrorBoundary>
      </div>
      <ErrorBoundary section="Rep Heatmap">
        <InsightPanel label="Rep heatmap" question="Which reps need help?" takeaway={repTakeaway(deals)}>
          <RepHeatmap risks={deals} onRepClick={rep => onGoToDeals({ rep })} />
        </InsightPanel>
      </ErrorBoundary>
    </div>
  );
};
