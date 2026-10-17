import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
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
        onGoToDeals={onGoToDeals}
      />,
    );
    expect(screen.getByText('Commit holds 1 HIGH-risk deal worth $10K.')).toBeInTheDocument();
    expect(screen.getByText(/the AI's own assessment/)).toBeInTheDocument();
    expect(screen.getByText('AI Forecast Confidence')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show Commit deals (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show dormant deals (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show deals for Jo' }));
    expect(onGoToDeals).toHaveBeenNthCalledWith(1, { stage: 'Commit' });
    expect(onGoToDeals).toHaveBeenNthCalledWith(2, { activity: 'dormant' });
    expect(onGoToDeals).toHaveBeenNthCalledWith(3, { rep: 'Jo' });
  });

  it('warns when the full deal list failed to load', () => {
    render(
      <PipelineHealthTab
        deals={[makeDeal()]}
        funnel={[]}
        forecastStat={forecastStat}
        dealsError="Missing or insufficient permissions."
        onGoToDeals={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load deals: Missing or insufficient permissions. Showing the capped list embedded in the report.',
    );
  });

  it('shows no warning when deals loaded', () => {
    render(<PipelineHealthTab deals={[makeDeal()]} funnel={[]} forecastStat={forecastStat} onGoToDeals={() => undefined} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
