import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { repTakeaway } from '@/lib/takeaways';
import { RepHeatmap } from './RepHeatmap';

const repButtons = () => screen.getAllByRole('button', { name: /^Show deals for / });

describe('RepHeatmap', () => {
  it('ranks reps riskiest first and opens a rep on click', () => {
    const onRepClick = vi.fn();
    render(<RepHeatmap risks={[makeDeal({ rep: 'Sam', healthScore: 80, level: 'LOW' }), makeDeal({ rep: 'Jo', healthScore: 30, level: 'HIGH' })]} onRepClick={onRepClick} />);
    const rows = repButtons();
    expect(rows.map(r => r.getAttribute('aria-label'))).toEqual([
      'Show deals for Jo: confidence 30, 1 at risk, 1 deal',
      'Show deals for Sam: confidence 80, 0 at risk, 1 deal',
    ]);
    fireEvent.click(rows[0]);
    expect(onRepClick).toHaveBeenCalledWith('Jo');
    // The panel header now comes from InsightPanel.
    expect(screen.queryByText('Rep Performance')).not.toBeInTheDocument();
  });

  it('ranks by value-weighted revenue confidence, the same figure the takeaway names', () => {
    // Average health would put B first (A averages 55); weighted by value, A's $100K deal at health 20 dominates.
    const deals = [
      makeDeal({ rep: 'A', healthScore: 20, pipelineValue: 100_000 }),
      makeDeal({ rep: 'A', healthScore: 90, pipelineValue: 1_000 }),
      makeDeal({ rep: 'B', healthScore: 40, pipelineValue: 10_000 }),
    ];
    render(<RepHeatmap risks={deals} onRepClick={() => undefined} />);
    expect(repButtons().map(r => r.getAttribute('aria-label'))).toEqual([
      'Show deals for A: confidence 21, 2 at risk, 2 deals',
      'Show deals for B: confidence 40, 1 at risk, 1 deal',
    ]);
    expect(repTakeaway(deals)).toMatch(/^A has the lowest revenue confidence \(21\/100\)/);
  });

  it('marks rows for an inset focus ring, since the scroll container clips an outset one', () => {
    render(<RepHeatmap risks={[makeDeal()]} onRepClick={() => undefined} />);
    expect(repButtons()[0]).toHaveAttribute('data-inset-focus');
  });
});
