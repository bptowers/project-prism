import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import type { DeltaIntelligenceData, RiskDeal } from '@/lib/types';
import { OverviewTab } from './OverviewTab';

const deals: RiskDeal[] = [
  makeDeal({ value: 'Commit Deal', region: 'uk', stage: 'Commit', healthScore: 20, level: 'HIGH', pipelineValue: 40_000 }),
  makeDeal({ value: 'Early Deal', region: 'uk', stage: 'Discovery', healthScore: 80, level: 'LOW' }),
  makeDeal({ value: 'NA Deal', region: 'na', stage: 'Proposal', healthScore: 50, level: 'MEDIUM' }),
];

function setup(overrides: Partial<React.ComponentProps<typeof OverviewTab>> = {}) {
  const handlers = { onGoToDeals: vi.fn(), onSelectRegion: vi.fn(), onSeeChanges: vi.fn() };
  render(
    <MemoryReviewsProvider>
      <OverviewTab deals={deals} allDeals={deals} region="all" briefing={{ briefing: 'Portfolio briefing.', isLive: true }} {...handlers} {...overrides} />
    </MemoryReviewsProvider>,
  );
  return handlers;
}

describe('OverviewTab', () => {
  it("queues only late-stage deals and tracks today's progress", () => {
    setup();
    const queue = screen.getByRole('region', { name: /Today's queue · 0 of 2 reviewed/ });
    expect(within(queue).getByRole('button', { name: 'Commit Deal' })).toBeInTheDocument();
    expect(within(queue).getByRole('button', { name: 'NA Deal' })).toBeInTheDocument();
    expect(within(queue).queryByRole('button', { name: 'Early Deal' })).not.toBeInTheDocument();

    fireEvent.click(within(queue).getByRole('button', { name: 'Mark reviewed: Commit Deal' }));
    expect(screen.getByRole('region', { name: /1 of 2 reviewed/ })).toBeInTheDocument();
  });

  it('KPI tiles click through to filtered deals', () => {
    const { onGoToDeals } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^At risk/ }));
    expect(onGoToDeals).toHaveBeenCalledWith({ riskOnly: true });
  });

  it('region cards select a region', () => {
    const { onSelectRegion } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^UK/ }));
    expect(onSelectRegion).toHaveBeenCalledWith('uk');
  });

  it('labels the briefing as global when a region is selected', () => {
    setup({ region: 'uk', deals: deals.slice(0, 2) });
    expect(screen.getByText('Global briefing: covers all regions, not just UK.')).toBeInTheDocument();
  });

  it('opens the deal popup from a risk-map bubble', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Commit Deal: \$40K/ }));
    expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
  });

  it('summarises changes since the last run, filtered to the region', () => {
    const delta: DeltaIntelligenceData = {
      comparedTo: '2026-10-11',
      significantDealChanges: {
        deteriorated: [
          { deal: 'A', rep: 'Jo', region: 'UK', change: 'Went quiet' },
          { deal: 'B', rep: 'Sam', region: 'North America', change: 'Slipped' },
        ],
        improved: [],
        newPipeline: { count: 4, totalMrr: '$10K', qualityAssessment: '' },
      },
    };
    const { onSeeChanges } = setup({ delta, region: 'uk' });
    expect(screen.getByText('↓ 1 got worse')).toBeInTheDocument();
    expect(screen.queryByText('4 new deals')).not.toBeInTheDocument(); // newPipeline has no region
    fireEvent.click(screen.getByRole('button', { name: 'See what changed →' }));
    expect(onSeeChanges).toHaveBeenCalled();
  });
});
