import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null }, storage: {}, db: {} }));
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (u: null) => void) => { cb(null); return () => undefined; }),
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(() => () => undefined), getDocs: vi.fn(),
}));

const regionState = {
  region: 'all' as const,
  data: {
    stats: {
      pipeline: { value: '—', change: '—', dir: 'flat' as const, sub: '' },
      atRisk: { value: '—', change: '—', dir: 'flat' as const, sub: '' },
      velocity: { value: '—', change: '—', dir: 'flat' as const, sub: '' },
      forecast: { value: '—', change: '—', dir: 'flat' as const, sub: '' },
    },
    sparklines: {}, funnel: [], winThemes: [], lossThemes: [], risks: [], signals: [], competitors: [], recommendations: [],
    trendData: { weeks: [], all: [], na: [], uk: [], au: [] },
  },
  allData: undefined as unknown,
  selectRegion: vi.fn(),
  loading: true,
  isLive: false,
  hasLiveData: false,
  showingContent: false,
  executiveBriefing: undefined,
  totalOpportunities: undefined,
  reportPeriod: undefined,
  reportDate: undefined as string | undefined,
  reportCreatedAt: undefined as string | undefined,
  regionCounts: undefined,
  dealsError: undefined,
  reportMeta: undefined,
  twentyQuestions: undefined,
  competitiveDisplacement: undefined,
  deltaIntelligence: undefined,
};
regionState.allData = regionState.data;

const useRegionMock = vi.fn(() => regionState);
vi.mock('@/hooks/useRegion', () => ({ useRegion: () => useRegionMock() }));

import App from './App';

describe('App loading and empty states', () => {
  it('shows a loading indicator, not the "No live data yet" empty state, while the report is loading', () => {
    useRegionMock.mockReturnValue({ ...regionState, loading: true, showingContent: false });
    render(<App />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('No live data yet')).not.toBeInTheDocument();
  });

  it('shows the empty state only once loading has finished with no report', () => {
    useRegionMock.mockReturnValue({ ...regionState, loading: false, showingContent: false });
    render(<App />);
    expect(screen.getByText('No live data yet')).toBeInTheDocument();
  });
});

describe('App header period', () => {
  it('formats the report date the same way as the footer', () => {
    useRegionMock.mockReturnValue({ ...regionState, loading: false, isLive: true, showingContent: true, reportDate: '2026-09-09' });
    render(<App />);
    expect(screen.getAllByText('Run 9 Sep 2026').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sep 9, 2026/)).not.toBeInTheDocument();
  });
});
