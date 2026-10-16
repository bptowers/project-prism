import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardNav } from './DashboardNav';

describe('DashboardNav', () => {
  const setup = () => {
    const onSelectTab = vi.fn();
    const onSelectRegion = vi.fn();
    render(<DashboardNav tab="overview" region="uk" regionCounts={{ na: 10, uk: 4, au: 6 }} onSelectTab={onSelectTab} onSelectRegion={onSelectRegion} />);
    return { onSelectTab, onSelectRegion };
  };

  it('shows the five tabs in order with the current one selected', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Overview', 'CRO Brief', 'Deals', 'Pipeline Health', 'Competition & Change']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('marks the selected region and shows deal counts, All being the total', () => {
    setup();
    expect(screen.getByRole('button', { name: /^UK/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^All/ })).toHaveTextContent('20');
  });

  it('reports tab and region clicks', () => {
    const { onSelectTab, onSelectRegion } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    fireEvent.click(screen.getByRole('button', { name: /^North America/ }));
    expect(onSelectTab).toHaveBeenCalledWith('deals');
    expect(onSelectRegion).toHaveBeenCalledWith('na');
  });
});
