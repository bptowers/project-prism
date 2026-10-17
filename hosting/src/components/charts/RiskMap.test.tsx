import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { mockResizeObserver } from '@/test/resizeObserver';
import { RiskMap } from './RiskMap';

afterEach(() => vi.unstubAllGlobals());

function radii() {
  return Array.from(screen.getByRole('group').querySelectorAll('circle')).map(c => Number(c.getAttribute('r')));
}

describe('RiskMap', () => {
  it('draws one accessible bubble per deal and opens a deal on click, Enter or Space', () => {
    const onDealClick = vi.fn();
    const acme = makeDeal({ value: 'Acme', healthScore: 20, daysStalled: 40, pipelineValue: 42_000 });
    render(<RiskMap risks={[acme, makeDeal({ value: 'Beta' })]} onDealClick={onDealClick} />);
    const bubble = screen.getByRole('button', { name: 'Acme: $42K, risk 80, 40 days since activity' });
    fireEvent.click(bubble);
    fireEvent.keyDown(bubble, { key: 'Enter' });
    fireEvent.keyDown(bubble, { key: ' ' });
    expect(onDealClick).toHaveBeenCalledTimes(3);
    expect(onDealClick).toHaveBeenCalledWith(acme);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('caps the chart at the 40 largest deals and says so', () => {
    const deals = Array.from({ length: 45 }, (_, i) => makeDeal({ pipelineValue: (i + 1) * 1_000 }));
    render(<RiskMap risks={deals} onDealClick={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(40);
    expect(screen.getByRole('button', { name: /: \$45K,/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /: \$1K,/ })).not.toBeInTheDocument();
    expect(screen.getByText('Showing the 40 largest of 45 deals')).toBeInTheDocument();
  });

  it('labels the risk bands in text, not colour alone, and is not clickable without a handler', () => {
    render(<RiskMap risks={[makeDeal()]} />);
    expect(screen.getByText('High risk')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('says so when there are no deals instead of drawing an empty grid', () => {
    render(<RiskMap risks={[]} />);
    expect(screen.getByText('No deals in this view.')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('keeps the 760-wide layout when the width cannot be measured', () => {
    render(<RiskMap risks={[makeDeal({ pipelineValue: 90_000 })]} />);
    expect(screen.getByRole('group')).toHaveAttribute('viewBox', '0 0 760 300');
    expect(screen.getByText('15d')).toBeInTheDocument();
    expect(screen.getByText('Danger zone: high risk, quiet 3+ weeks')).toBeInTheDocument();
    expect(Math.max(...radii())).toBe(18);
  });

  it('draws one viewBox unit per CSS pixel and simplifies at phone width', () => {
    mockResizeObserver(360);
    render(<RiskMap risks={[makeDeal({ pipelineValue: 90_000 }), makeDeal({ pipelineValue: 1_000 })]} />);
    expect(screen.getByRole('group')).toHaveAttribute('viewBox', '0 0 360 260');
    expect(screen.getAllByText(/^\d+d\+?$/).map(t => t.textContent)).toEqual(['0d', '30d', '60d+']);
    expect(screen.getByText('Danger zone')).toBeInTheDocument();
    expect(Math.max(...radii())).toBe(14);
  });

  it('never draws narrower than 320 or wider than 960 units', () => {
    mockResizeObserver(200);
    const { unmount } = render(<RiskMap risks={[makeDeal()]} />);
    expect(screen.getByRole('group').getAttribute('viewBox')).toMatch(/^0 0 320 /);
    unmount();
    mockResizeObserver(1400);
    render(<RiskMap risks={[makeDeal()]} />);
    expect(screen.getByRole('group')).toHaveAttribute('viewBox', '0 0 960 300');
  });
});
