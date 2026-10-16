import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { makeDeal, makeRegionData } from '@/test/fixtures';
import type { RegionData } from '@/lib/types';
import type { ReviewsApi } from '@/lib/reviews';

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: { currentUser: null } }));
vi.mock('@/components/layout/Header', () => ({
  Header: ({ period }: { period?: string }) => <div data-testid="header">{period}</div>,
}));
vi.mock('@/components/dashboard/UploadModal', () => ({ UploadModal: () => null }));
let reviewsState: ReviewsApi;
vi.mock('@/hooks/useSharedReviews', () => ({ useSharedReviews: () => reviewsState }));
let regionState: Record<string, unknown> = {};
vi.mock('@/hooks/useRegion', () => ({ useRegion: () => regionState }));

import App from './App';

function liveState(all: RegionData) {
  return {
    data: all, allData: all, loading: false, isLive: true, hasLiveData: true, showingContent: true,
    executiveBriefing: 'Briefing text for the portfolio.', totalOpportunities: 2, reportPeriod: undefined,
    reportDate: '2026-10-14', reportCreatedAt: undefined, regionCounts: { uk: 1, na: 1 }, dealsError: undefined,
    reportMeta: undefined, twentyQuestions: undefined, competitiveDisplacement: undefined, deltaIntelligence: undefined,
  };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  reviewsState = { getReview: () => undefined, isDone: () => false, isWorse: () => false, toggle: () => undefined };
  regionState = liveState(makeRegionData([
    makeDeal({ value: 'UK Deal', region: 'uk', level: 'HIGH', stage: 'Commit', healthScore: 20 }),
    makeDeal({ value: 'NA Deal', region: 'na', level: 'LOW', stage: 'Discovery', healthScore: 85 }),
  ]));
});

describe('App loading and empty states', () => {
  it('shows a loading indicator, not the "No live data yet" empty state, while the report is loading', () => {
    regionState = { ...regionState, loading: true, isLive: false, showingContent: false };
    render(<App />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('No live data yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows the empty state only once loading has finished with no report', () => {
    regionState = { ...regionState, loading: false, isLive: false, showingContent: false };
    render(<App />);
    expect(screen.getByText('No live data yet')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});

describe('App header period', () => {
  it('formats the report date the same way as the footer', () => {
    regionState = { ...regionState, reportDate: '2026-09-09' };
    render(<App />);
    expect(screen.getByTestId('header')).toHaveTextContent('Data as of 9 Sep 2026');
    expect(screen.queryByText(/Sep 9, 2026/)).not.toBeInTheDocument();
  });

  it('falls back to the report period rather than labelling an unparseable date', () => {
    regionState = { ...regionState, reportDate: 'not-a-date', reportPeriod: 'Q4 2026' };
    render(<App />);
    expect(screen.getByTestId('header')).toHaveTextContent(/^Q4 2026$/);
  });
});

describe('App shell', () => {
  it('opens on the Overview tab with the briefing and data freshness', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Briefing text for the portfolio.')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent('Data as of 14 Oct 2026');
  });

  it('switches tabs and records the view in the URL', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    expect(screen.getByRole('tab', { name: 'Deals' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('#deals?region=all');
  });

  it('narrows the Deals tab to the selected region', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    // Scope to the nav: the Deals tab has its own filter chips that may also say "UK".
    fireEvent.click(within(screen.getByRole('group', { name: 'Region' })).getByRole('button', { name: /^UK/ }));
    expect(screen.getByRole('button', { name: 'Open UK Deal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open NA Deal' })).not.toBeInTheDocument();
  });

  it('keeps the main landmark and labels the tab panel by the active tab', () => {
    render(<App />);
    const panel = within(screen.getByRole('main')).getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'dashboard-tabpanel');
    expect(panel).toHaveAccessibleName('Overview');
  });

  it('gives the page a top-level heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows no review alert while reviews sync', () => {
    render(<App />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a review sync error as is and lets the user dismiss it', () => {
    const clearError = vi.fn();
    reviewsState = { ...reviewsState, error: "Couldn't save the review: permission-denied", clearError };
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Couldn't save the review: permission-denied/);
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Dismiss' }));
    expect(clearError).toHaveBeenCalledTimes(1);
  });
});
