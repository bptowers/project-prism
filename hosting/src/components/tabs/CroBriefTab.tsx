import React from 'react';
import type { Recommendation, Region, RiskDeal, TwentyQuestionsData } from '@/lib/types';
import { DealsLoadError } from '@/components/ui/DealsLoadError';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Interventions } from '@/components/cro/Interventions';
import { ActionList } from '@/components/cro/ActionList';
import { CroQuestionsGrid } from '@/components/cro/CroQuestionsGrid';

interface Props {
  twentyQuestions?: TwentyQuestionsData;
  recommendations: Recommendation[];
  region: Region;
  deals: RiskDeal[];
  dealsError?: string;
  isLive?: boolean;
}

/** What do I need to push on this week? Each section has its own boundary so one bad AI payload never blanks the tab. */
export const CroBriefTab: React.FC<Props> = ({ twentyQuestions, recommendations, region, deals, dealsError, isLive }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
    {/* Without the full deal list, fewer AI-named deals match one that can be reviewed. */}
    <DealsLoadError error={dealsError} hasDeals={deals.length > 0} />
    <ErrorBoundary section="CRO Interventions">
      <Interventions data={twentyQuestions} region={region} deals={deals} isLive={isLive} />
    </ErrorBoundary>
    <ErrorBoundary section="This Week's Actions">
      {/* Keyed by region so an expanded action never carries over to another region's list. */}
      <ActionList key={region} items={recommendations} />
    </ErrorBoundary>
    <ErrorBoundary section="CRO Questions">
      <CroQuestionsGrid data={twentyQuestions} region={region} isLive={isLive} />
    </ErrorBoundary>
  </div>
);
