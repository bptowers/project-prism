import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
let throwActionList = false;
vi.mock('@/components/cro/ActionList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/cro/ActionList')>();
  return {
    ActionList: (props: Parameters<typeof actual.ActionList>[0]) => {
      if (throwActionList) throw new Error('bad payload');
      return actual.ActionList(props);
    },
  };
});

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
  throwActionList = false;
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

describe('App tab content', () => {
  it('drops the Deals tab\'s rep filter when the region changes', () => {
    regionState = liveState(makeRegionData([
      makeDeal({ value: 'UK Deal', region: 'uk', rep: 'Ana', level: 'HIGH', stage: 'Commit', healthScore: 20 }),
      makeDeal({ value: 'NA Deal', region: 'na', rep: 'Ben', level: 'LOW', stage: 'Discovery', healthScore: 85 }),
    ]));
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    fireEvent.change(screen.getByLabelText('Rep'), { target: { value: 'Ana' } });
    expect(window.location.hash).toContain('rep=Ana');
    expect(screen.queryByRole('button', { name: 'Open NA Deal' })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'Region' })).getByRole('button', { name: /^North America/ }));
    expect(window.location.hash).not.toContain('rep=');
    expect(screen.getByRole('button', { name: 'Open NA Deal' })).toBeInTheDocument();
  });

  it('shows the deals-load error on the Deals tab', () => {
    regionState = { ...regionState, dealsError: 'Missing or insufficient permissions.' };
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load deals: Missing or insufficient permissions. Showing the capped list embedded in the report.');
  });

  it('keeps a sibling widget on screen when one widget throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    throwActionList = true;
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'CRO Brief' }));
    expect(screen.getByText("This Week's Actions could not be displayed")).toBeInTheDocument();
    expect(screen.getByText('CRO questions')).toBeInTheDocument();
  });

  it('makes the tab panel focusable', () => {
    render(<App />);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');
  });
});

describe('App tab scroll', () => {
  const scrollTo = vi.fn();
  const rect = (top: number, height = 0) => ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

  beforeEach(() => {
    scrollTo.mockReset();
    vi.stubGlobal('scrollTo', scrollTo);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  function renderScrolledDown(panelTop: number) {
    render(<App />);
    vi.spyOn(screen.getByRole('navigation', { name: 'Dashboard' }), 'getBoundingClientRect').mockReturnValue(rect(0, 100));
    vi.spyOn(screen.getByRole('tabpanel'), 'getBoundingClientRect').mockReturnValue(rect(panelTop));
  }

  it('brings the top of the tab panel back into view below the sticky nav', () => {
    renderScrolledDown(-400);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  });

  it('jumps without animating when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    renderScrolledDown(-400);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'auto' });
  });

  it('scrolls to the top of the Deals tab when an Overview tile opens it', () => {
    renderScrolledDown(-400);
    fireEvent.click(screen.getByRole('button', { name: /^At risk/ }));
    expect(screen.getByRole('tab', { name: 'Deals' })).toHaveAttribute('aria-selected', 'true');
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  });

  it('leaves the scroll alone when the panel top is already visible', () => {
    renderScrolledDown(150);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
