import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import { dealKey, type DealReview } from '@/lib/reviews';
import type { DeltaIntelligenceData, RiskDeal } from '@/lib/types';
import { OverviewTab } from './OverviewTab';

const deals: RiskDeal[] = [
  makeDeal({ value: 'Commit Deal', region: 'uk', stage: 'Commit', healthScore: 20, level: 'HIGH', pipelineValue: 40_000 }),
  makeDeal({ value: 'Early Deal', region: 'uk', stage: 'Discovery', healthScore: 80, level: 'LOW' }),
  makeDeal({ value: 'NA Deal', region: 'na', stage: 'Proposal', healthScore: 50, level: 'MEDIUM' }),
];

function setup(overrides: Partial<React.ComponentProps<typeof OverviewTab>> = {}, initialReviews: Record<string, DealReview> = {}) {
  const handlers = { onGoToDeals: vi.fn(), onSelectRegion: vi.fn(), onSeeChanges: vi.fn() };
  render(
    <MemoryReviewsProvider initial={initialReviews}>
      <OverviewTab deals={deals} allDeals={deals} region="all" briefing={{ briefing: 'Portfolio briefing.', isLive: true }} {...handlers} {...overrides} />
    </MemoryReviewsProvider>,
  );
  return handlers;
}

const queueNames = () => within(screen.getByRole('region', { name: /Today's queue/ }))
  .getAllByRole('listitem')
  .map(li => within(li).getAllByRole('button')[0].textContent);

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

  it('does not count a deal that got worse since its review as reviewed', () => {
    // Commit Deal's risk is 80 now; it was 50 when reviewed.
    setup({}, {
      [dealKey(deals[0])]: { reviewedBy: 'a@simprogroup.com', reviewedByName: 'A', reviewedAt: new Date('2026-10-10T09:00:00Z'), riskAtReview: 50 },
    });
    const queue = screen.getByRole('region', { name: /Today's queue · 0 of 2 reviewed/ });
    expect(within(queue).getByRole('button', { name: 'Review again: Commit Deal' })).toBeInTheDocument();
  });

  it('caps the queue at the five riskiest late-stage deals, ties broken by value then name', () => {
    const late = [
      makeDeal({ value: 'Risk 60', stage: 'Commit', healthScore: 40 }),
      makeDeal({ value: 'Risk 90', stage: 'Negotiation', healthScore: 10 }),
      makeDeal({ value: 'Bravo', stage: 'Proposal', healthScore: 30, pipelineValue: 5_000 }),
      makeDeal({ value: 'Alpha', stage: 'Proposal', healthScore: 30, pipelineValue: 5_000 }),
      makeDeal({ value: 'Big 70', stage: 'Proposal', healthScore: 30, pipelineValue: 50_000 }),
      makeDeal({ value: 'Risk 20', stage: 'Commit', healthScore: 80 }),
      makeDeal({ value: 'Early', stage: 'Discovery', healthScore: 0 }),
    ];
    setup({ deals: late, allDeals: late });
    expect(queueNames()).toEqual(['Risk 90', 'Big 70', 'Alpha', 'Bravo', 'Risk 60']);
  });

  it('shows revenue confidence on the KPI tile and clicks through to red deals', () => {
    const { onGoToDeals } = setup();
    // Value-weighted: (20×40K + 80×10K + 50×10K) / 60K = 35.
    const tile = screen.getByRole('button', { name: /^Revenue confidence/ });
    expect(within(tile).getByText('35/100')).toBeInTheDocument();
    expect(within(tile).getByText('At risk')).toBeInTheDocument();
    fireEvent.click(tile);
    expect(onGoToDeals).toHaveBeenCalledWith({ band: 'Red' });
  });

  it('KPI tiles click through to filtered deals', () => {
    const { onGoToDeals } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^At risk/ }));
    expect(onGoToDeals).toHaveBeenCalledWith({ riskOnly: true });
  });

  it('shows a dash, not $0, for deals that carry no value', () => {
    const noValue = [makeDeal({ value: 'No Value', region: 'uk', stage: 'Commit', level: 'HIGH', pipelineValue: 0 })];
    setup({ deals: noValue, allDeals: noValue });
    expect(within(screen.getByRole('button', { name: /^Pipeline value/ })).getByText('—')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /^At risk/ })).getByText('—')).toBeInTheDocument();
    const queue = screen.getByRole('region', { name: /Today's queue/ });
    expect(within(within(queue).getByRole('listitem')).getByText('—')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /^UK/ })).getAllByText(/—/)).toHaveLength(2);
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
  });

  it('shows no confidence figure or gauge when the view has no deals', () => {
    setup({ region: 'au', deals: [] });
    const tile = screen.getByRole('button', { name: /^Revenue confidence/ });
    expect(within(tile).getByText('—')).toBeInTheDocument();
    expect(within(tile).getByText('No deals in view')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Revenue confidence/ })).not.toBeInTheDocument();
  });

  it('region cards select a region', () => {
    const { onSelectRegion } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^UK/ }));
    expect(onSelectRegion).toHaveBeenCalledWith('uk');
  });

  it('clicking the selected region card goes back to all regions', () => {
    const { onSelectRegion } = setup({ region: 'uk', deals: deals.slice(0, 2) });
    const card = screen.getByRole('button', { name: /^UK/ });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(card);
    expect(onSelectRegion).toHaveBeenCalledWith('all');
  });

  it('a region with no deals says so and stays clickable', () => {
    const { onSelectRegion } = setup();
    const card = screen.getByRole('button', { name: /^AU \/ NZ/ });
    expect(within(card).getByText('No deals in this report')).toBeInTheDocument();
    expect(within(card).queryByText(/\/100/)).not.toBeInTheDocument();
    fireEvent.click(card);
    expect(onSelectRegion).toHaveBeenCalledWith('au');
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

  it('summarises changes since the last run, filtered to the region, with no LLM-authored numbers', () => {
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
    const strip = screen.getByRole('region', { name: 'Since last run' });
    expect(within(strip).getByText('1 got worse')).toBeInTheDocument();
    expect(within(strip).getByText('0 improved')).toBeInTheDocument();
    // newPipeline.count and comparedTo are written by the LLM, so neither is shown.
    expect(within(strip).queryByText(/new deals/)).not.toBeInTheDocument();
    expect(within(strip).queryByText(/11 Oct 2026/)).not.toBeInTheDocument();
    fireEvent.click(within(strip).getByRole('button', { name: 'See what changed →' }));
    expect(onSeeChanges).toHaveBeenCalled();
  });

  it('counts change rows defensively when the LLM sends malformed ones', () => {
    const delta = {
      significantDealChanges: {
        deteriorated: [null, { deal: 'Numeric', region: 42 }, { deal: 'Real', region: 'UK' }],
        improved: 'none this week',
      },
    } as unknown as DeltaIntelligenceData;
    setup({ delta, region: 'uk' });
    const strip = screen.getByRole('region', { name: 'Since last run' });
    expect(within(strip).getByText('1 got worse')).toBeInTheDocument();
    expect(within(strip).getByText('0 improved')).toBeInTheDocument();
  });

  it('says there is no comparison yet when the delta is missing', () => {
    setup({ delta: undefined });
    expect(within(screen.getByRole('region', { name: 'Since last run' })).getByText('No comparison with the last run yet.')).toBeInTheDocument();
  });
});
