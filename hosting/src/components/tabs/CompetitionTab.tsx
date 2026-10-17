import React, { useMemo } from 'react';
import type { CompetitiveDisplacementData, DeltaIntelligenceData, Region, TwentyQuestionsData } from '@/lib/types';
import { buildCompetitorCards } from '@/lib/competitors';
import { competitorTakeaway } from '@/lib/takeaways';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { WhatChanged } from '@/components/competition/WhatChanged';
import { CompetitorCards } from '@/components/competition/CompetitorCards';
import { DeltaIntelligence, hasChangeDetail } from '@/components/dashboard/DeltaIntelligence';
import { CompetitiveDisplacement } from '@/components/dashboard/CompetitiveDisplacement';

interface Props {
  delta?: DeltaIntelligenceData;
  displacement?: CompetitiveDisplacementData;
  twentyQuestions?: TwentyQuestionsData;
  region: Region;
  isLive?: boolean;
}

const disclosure: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '0.5rem 1.1rem', background: 'var(--bg-surface)' };
const summary: React.CSSProperties = { cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', padding: '0.5rem 0', minHeight: 40, boxSizing: 'border-box' };

/** What moved, and who are we up against? The full AI analyses stay one click away. Each section has its own boundary. */
export const CompetitionTab: React.FC<Props> = ({ delta, displacement, twentyQuestions, region, isLive }) => {
  const cards = useMemo(
    () => buildCompetitorCards(twentyQuestions?.question6?.threats, displacement?.lossMechanisms, region),
    [twentyQuestions, displacement, region],
  );
  // The disclosed analyses are the AI's portfolio-wide views; they are not filtered to the region.
  const scope = region !== 'all' ? ' (all regions)' : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <ErrorBoundary section="What changed">
        <WhatChanged data={delta} region={region} isLive={isLive} />
      </ErrorBoundary>
      {hasChangeDetail(delta) && (
        <details style={disclosure}>
          <summary style={summary}>More change detail: forecast drift, regional trajectory, competitor momentum{scope}</summary>
          <div style={{ marginTop: '0.5rem' }}>
            <ErrorBoundary section="Delta Intelligence">
              <DeltaIntelligence data={delta} isLive={isLive} hideSummary />
            </ErrorBoundary>
          </div>
        </details>
      )}
      <ErrorBoundary section="Competition">
        <InsightPanel label="Competition" question="Who are we up against, and where?" takeaway={competitorTakeaway(cards)}>
          <CompetitorCards cards={cards} />
        </InsightPanel>
      </ErrorBoundary>
      {(displacement || isLive) && (
        <details style={disclosure}>
          <summary style={summary}>Full competitive analysis: win mechanisms, regional arbitrage, re-warm opportunities{scope}</summary>
          <div style={{ marginTop: '0.5rem' }}>
            <ErrorBoundary section="Competitive Displacement">
              <CompetitiveDisplacement data={displacement} isLive={isLive} />
            </ErrorBoundary>
          </div>
        </details>
      )}
    </div>
  );
};
