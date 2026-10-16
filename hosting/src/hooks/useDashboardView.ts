import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { parseHash, toHash, type DashboardView, type TabKey } from '@/lib/dashboardView';

export const LAST_REGION_KEY = 'prism-last-region';
const REGIONS: Region[] = ['all', 'na', 'uk', 'au'];

function readStoredRegion(): Region | undefined {
  try {
    const value = localStorage.getItem(LAST_REGION_KEY);
    return REGIONS.includes(value as Region) ? (value as Region) : undefined;
  } catch {
    return undefined;
  }
}

function storeRegion(region: Region): void {
  try {
    localStorage.setItem(LAST_REGION_KEY, region);
  } catch {
    // Private mode / blocked storage: remembering the region is a convenience only.
  }
}

function viewFromHash(hash: string): DashboardView {
  const parsed = parseHash(hash);
  return { ...parsed, tab: parsed.tab ?? 'overview', region: parsed.region ?? readStoredRegion() ?? 'all' };
}

/**
 * Single source of truth for tab, region and Deals filters. The URL hash
 * mirrors it so views are shareable and the browser back button works.
 */
export function useDashboardView() {
  const [view, setView] = useState<DashboardView>(() => viewFromHash(window.location.hash));
  const viewRef = useRef(view);
  viewRef.current = view;

  // Make the address bar show the resolved view without adding a history entry.
  useEffect(() => {
    window.history.replaceState(null, '', toHash(viewRef.current));
  }, []);

  useEffect(() => {
    const sync = () => setView(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback((next: DashboardView) => {
    const hash = toHash(next);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    storeRegion(next.region);
    // Keep state equal to what a reload of this hash would give (e.g. rep: '' is dropped).
    const canonical = viewFromHash(hash);
    viewRef.current = canonical;
    setView(canonical);
  }, []);

  const selectTab = useCallback((tab: TabKey) => navigate({ ...viewRef.current, tab }), [navigate]);

  // A rep belongs to one region, so changing region drops the rep filter.
  const selectRegion = useCallback(
    (region: Region) => navigate({ ...viewRef.current, region, rep: undefined }),
    [navigate],
  );

  const setFilters = useCallback(
    (patch: Partial<DealFilters & { hideReviewed?: boolean }>) => navigate({ ...viewRef.current, ...patch }),
    [navigate],
  );

  const goToDeals = useCallback(
    (filters: DealFilters = {}) => navigate({ tab: 'deals', region: viewRef.current.region, ...filters }),
    [navigate],
  );

  return { view, selectTab, selectRegion, setFilters, goToDeals };
}
