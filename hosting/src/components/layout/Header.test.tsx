import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

type FakeUser = { email: string; getIdToken: () => Promise<string> } | null;
let authUser: FakeUser = null;

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (u: FakeUser) => void) => { cb(authUser); return () => undefined; }),
}));

import { Header } from './Header';

const signedIn: FakeUser = { email: 'brad@simprogroup.com', getIdToken: async () => 'id-token' };

describe('Header run analysis', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    authUser = signedIn;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for confirmation before running and can be cancelled', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
    expect(screen.getByText(/Run full analysis\? ~10 min, re-generates today's report\./)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Run full analysis\?/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the signed-in user token once confirmed', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run' })); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/bigquery');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer id-token');
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });

  it('shows "Sign in required" and never calls the API when nobody is signed in', () => {
    authUser = null;
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
    expect(screen.getByText('Sign in required')).toBeInTheDocument();
    expect(screen.queryByText(/Run full analysis\?/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a gateway timeout as "run started" rather than a failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 504 });
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run' })); });
    expect(screen.getByText('Run started — results appear when the report updates')).toBeInTheDocument();
    expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
  });

  it('reports a real function error with its status code', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run' })); });
    expect(screen.getByText('Failed (HTTP 401)')).toBeInTheDocument();
  });

  it('shows the signed-in email from the auth subscription and no dead export buttons', () => {
    render(<Header />);
    expect(screen.getByText('brad@simprogroup.com')).toBeInTheDocument();
    expect(screen.queryByText('Export PDF')).not.toBeInTheDocument();
    expect(screen.queryByText('Export Slides')).not.toBeInTheDocument();
  });

  it('shows how long ago the report was generated from its timestamp', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    render(<Header isLive period="Run 9 Sep 2026" generatedAt={twoHoursAgo} />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('shows when the next scheduled refresh is', () => {
    render(<Header isLive period="Data as of 14 Oct 2026" nextRefresh="16 Oct 2026" />);
    expect(screen.getByText('Data as of 14 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Next scheduled refresh 16 Oct 2026')).toBeInTheDocument();
  });
});

// jsdom has no layout; this only checks the rows are allowed to wrap at phone width.
describe('Header narrow screens', () => {
  beforeEach(() => {
    authUser = signedIn;
  });

  it('lets the brand and control rows wrap instead of overflowing', () => {
    const { container } = render(<Header isLive period="Data as of 14 Oct 2026" />);
    const row = container.querySelector('header > div') as HTMLElement;
    const brand = row.children[0] as HTMLElement;
    const controls = screen.getByRole('button', { name: 'Upload CSV' }).parentElement as HTMLElement;
    for (const el of [row, brand, controls]) {
      expect(el.style.flexWrap).toBe('wrap');
      expect(el.style.minWidth).toBe('0px');
    }
  });

  it('lets the long run-status and confirm text wrap', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
    const confirm = screen.getByRole('group', { name: 'Confirm run analysis' });
    expect(confirm.style.flexWrap).toBe('wrap');
    expect(screen.getByText(/Run full analysis\?/).style.whiteSpace).not.toBe('nowrap');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Run Analysis' }).style.whiteSpace).toBe('normal');
  });
});
