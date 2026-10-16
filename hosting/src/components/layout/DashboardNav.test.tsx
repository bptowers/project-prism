import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  it('gives each tab the id and aria-controls the tab panel relies on', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.id)).toEqual(['tab-overview', 'tab-cro', 'tab-deals', 'tab-health', 'tab-comp']);
    tabs.forEach(t => expect(t).toHaveAttribute('aria-controls', 'dashboard-tabpanel'));
  });

  it('names each region pill with its deal count', () => {
    setup();
    expect(screen.getByRole('button', { name: 'UK, 4 deals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All, 20 deals' })).toBeInTheDocument();
  });

  it('shows 0 for a region with no deals', () => {
    render(<DashboardNav tab="overview" region="all" regionCounts={{ na: 10, uk: 4 }} onSelectTab={vi.fn()} onSelectRegion={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^AU \/ NZ/ })).toHaveTextContent('AU / NZ0');
    expect(screen.getByRole('button', { name: 'AU / NZ, 0 deals' })).toBeInTheDocument();
  });

  it('renders no counts when regionCounts is undefined', () => {
    render(<DashboardNav tab="overview" region="all" onSelectTab={vi.fn()} onSelectRegion={vi.fn()} />);
    const pills = within(screen.getByRole('group', { name: 'Region' })).getAllByRole('button');
    expect(pills.map(b => b.textContent)).toEqual(['All', 'North America', 'UK', 'AU / NZ']);
    expect(screen.getByRole('button', { name: 'UK' })).not.toHaveAttribute('aria-label');
  });

  it('keeps only the active tab in the Tab order', () => {
    setup();
    expect(screen.getAllByRole('tab').map(t => t.tabIndex)).toEqual([0, -1, -1, -1, -1]);
  });

  it('moves focus with ArrowRight without selecting the tab', () => {
    const { onSelectTab } = setup();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'CRO Brief' })).toHaveFocus();
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it('wraps ArrowLeft from the first tab to the last', () => {
    setup();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Competition & Change' })).toHaveFocus();
  });

  it('jumps to the last tab with End and back to the first with Home', () => {
    setup();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    fireEvent.keyDown(overview, { key: 'End' });
    const last = screen.getByRole('tab', { name: 'Competition & Change' });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Home' });
    expect(overview).toHaveFocus();
  });
});
