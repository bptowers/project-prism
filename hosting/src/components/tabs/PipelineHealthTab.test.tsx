import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { applyDealFilters } from '@/lib/dealFilters';
import { PipelineHealthTab } from './PipelineHealthTab';

const forecastStat = { value: '70%', change: '—', dir: 'flat' as const, sub: '' };

describe('PipelineHealthTab', () => {
  it('leads each panel with a takeaway and drills into Deals', () => {
    const onGoToDeals = vi.fn();
    render(
      <PipelineHealthTab
        deals={[makeDeal({ stage: 'Commit', level: 'HIGH', healthScore: 20, daysStalled: 20, rep: 'Jo' })]}
        funnel={[]}
        forecastStat={{ value: '70%', change: '—', dir: 'flat', sub: '' }}
        region="all"
        onGoToDeals={onGoToDeals}
      />,
    );
    expect(screen.getByText('Commit holds 1 HIGH-risk deal worth $10K.')).toBeInTheDocument();
    expect(screen.getByText(/the AI's own assessment/)).toBeInTheDocument();
    expect(screen.queryByText(/covers all regions/)).not.toBeInTheDocument();
    expect(screen.getByText('AI Forecast Confidence')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show Commit deals: 1 deal, 1 high risk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show dormant deals: 1 deal, 100%' }));
    fireEvent.click(screen.getByRole('button', { name: /^Show deals for Jo: / }));
    expect(onGoToDeals).toHaveBeenNthCalledWith(1, { stage: 'Commit' });
    expect(onGoToDeals).toHaveBeenNthCalledWith(2, { activity: 'dormant' });
    expect(onGoToDeals).toHaveBeenNthCalledWith(3, { rep: 'Jo' });
  });

  it('every stage, bucket and rep click-through lists exactly the deals the row counts', () => {
    const deals = [
      makeDeal({ stage: 'Awaiting Signature', level: 'HIGH', daysStalled: 3, rep: 'Jo' }),
      makeDeal({ stage: 'Commit', level: 'MEDIUM', daysStalled: 9, rep: 'Jo' }),
      makeDeal({ stage: 'Proposal Draft', level: 'LOW', daysStalled: 20, rep: undefined }),
      makeDeal({ stage: '  Custom Stage ', level: 'LOW', daysStalled: 45, rep: '  ' }),
      makeDeal({ stage: 'Discovery', level: 'HIGH', daysStalled: 0, rep: 'Sam' }),
    ];
    const onGoToDeals = vi.fn();
    render(<PipelineHealthTab deals={deals} funnel={[]} forecastStat={forecastStat} region="all" onGoToDeals={onGoToDeals} />);

    const buttons = screen.getAllByRole('button', { name: /^Show / });
    const labels = buttons.map(b => b.getAttribute('aria-label') ?? '');
    // 4 stages (Awaiting Signature folds into Commit), 4 activity buckets, 3 reps.
    expect(buttons).toHaveLength(11);
    expect(labels).toContain('Show Commit deals: 2 deals, 1 high risk');
    expect(labels).toContain('Show Custom Stage deals: 1 deal, 0 high risk');
    expect(labels.some(l => l.startsWith('Show deals for Unassigned: '))).toBe(true);

    for (const button of buttons) {
      const label = button.getAttribute('aria-label') ?? '';
      const count = Number(/(\d+) deals?\b/.exec(label)?.[1]);
      fireEvent.click(button);
      const filters = onGoToDeals.mock.lastCall?.[0];
      expect(applyDealFilters(deals, filters), label).toHaveLength(count);
    }
  });

  it('says the AI forecast covers all regions when a region is selected', () => {
    render(<PipelineHealthTab deals={[makeDeal()]} funnel={[]} forecastStat={forecastStat} region="uk" onGoToDeals={() => undefined} />);
    expect(screen.getByText(/the AI's own assessment/)).toHaveTextContent(/The AI figure covers all regions, not just UK\.$/);
  });

  it('warns when the full deal list failed to load', () => {
    render(
      <PipelineHealthTab
        deals={[makeDeal()]}
        funnel={[]}
        forecastStat={forecastStat}
        region="all"
        dealsError="Missing or insufficient permissions."
        onGoToDeals={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load deals: Missing or insufficient permissions. Showing the capped list embedded in the report.',
    );
  });

  it('shows no warning when deals loaded', () => {
    render(<PipelineHealthTab deals={[makeDeal()]} funnel={[]} forecastStat={forecastStat} region="all" onGoToDeals={() => undefined} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
