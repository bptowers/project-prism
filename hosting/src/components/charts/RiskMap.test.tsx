import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { RiskMap } from './RiskMap';

describe('RiskMap', () => {
  it('draws one accessible bubble per deal and opens a deal on click or Enter', () => {
    const onDealClick = vi.fn();
    const acme = makeDeal({ value: 'Acme', healthScore: 20, daysStalled: 40, pipelineValue: 42_000 });
    render(<RiskMap risks={[acme, makeDeal({ value: 'Beta' })]} onDealClick={onDealClick} />);
    const bubble = screen.getByRole('button', { name: 'Acme: $42K, risk 80, 40 days since activity' });
    fireEvent.click(bubble);
    fireEvent.keyDown(bubble, { key: 'Enter' });
    expect(onDealClick).toHaveBeenCalledTimes(2);
    expect(onDealClick).toHaveBeenCalledWith(acme);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('caps the chart at the 40 largest deals and says so', () => {
    const deals = Array.from({ length: 45 }, (_, i) => makeDeal({ pipelineValue: (i + 1) * 1_000 }));
    render(<RiskMap risks={deals} onDealClick={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(40);
    expect(screen.getByText('Showing the 40 largest of 45 deals')).toBeInTheDocument();
  });

  it('labels the risk bands in text, not colour alone', () => {
    render(<RiskMap risks={[makeDeal()]} />);
    expect(screen.getByText('High risk')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});
