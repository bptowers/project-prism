import React from 'react';
import type { Recommendation, Region, RiskDeal, TwentyQuestionsData } from '@/lib/types';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Interventions } from '@/components/cro/Interventions';
import { ActionList } from '@/components/cro/ActionList';
import { CroQuestionsGrid } from '@/components/cro/CroQuestionsGrid';

interface Props {
  twentyQuestions?: TwentyQuestionsData;
  recommendations: Recommendation[];
  region: Region;
  deals: RiskDeal[];
  isLive?: boolean;
}

/** What do I need to push on this week? Each section has its own boundary so one bad AI payload never blanks the tab. */
export const CroBriefTab: React.FC<Props> = ({ twentyQuestions, recommendations, region, deals, isLive }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
    <ErrorBoundary section="CRO Interventions">
      <Interventions data={twentyQuestions} region={region} deals={deals} isLive={isLive} />
    </ErrorBoundary>
    <ErrorBoundary section="This Week's Actions">
      <ActionList items={recommendations} />
    </ErrorBoundary>
    <ErrorBoundary section="CRO Questions">
      <CroQuestionsGrid data={twentyQuestions} region={region} isLive={isLive} />
    </ErrorBoundary>
  </div>
);
