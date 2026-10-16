import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboardView, LAST_REGION_KEY } from './useDashboardView';

beforeEach(() => {
  localStorage.clear();
  // Push (not replace) so each test starts at the end of the stack: a test that
  // goes back leaves forward entries, which would make history.length checks vacuous.
  window.history.pushState(null, '', '/');
});

describe('useDashboardView', () => {
  it('defaults to Overview / All and writes that to the address bar', () => {
    const { result } = renderHook(() => useDashboardView());
    expect(result.current.view).toEqual({ tab: 'overview', region: 'all' });
    expect(window.location.hash).toBe('#overview?region=all');
  });

  it('reads the view from the hash', () => {
    window.history.replaceState(null, '', '/#deals?region=uk&rep=Jo');
    const { result } = renderHook(() => useDashboardView());
    expect(result.current.view).toEqual({ tab: 'deals', region: 'uk', rep: 'Jo' });
  });

  it('falls back to the last region this browser used', () => {
    localStorage.setItem(LAST_REGION_KEY, 'au');
    const { result } = renderHook(() => useDashboardView());
    expect(result.current.view.region).toBe('au');
  });

  it('selectRegion updates the hash and memory and clears the rep', () => {
    window.history.replaceState(null, '', '/#deals?region=uk&rep=Jo');
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.selectRegion('na'));
    expect(result.current.view).toEqual({ tab: 'deals', region: 'na' });
    expect(window.location.hash).toBe('#deals?region=na');
    expect(localStorage.getItem(LAST_REGION_KEY)).toBe('na');
  });

  it('goToDeals switches tab, keeps region and replaces filters', () => {
    window.history.replaceState(null, '', '/#overview?region=uk&stage=Commit');
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.goToDeals({ riskOnly: true }));
    expect(result.current.view).toEqual({ tab: 'deals', region: 'uk', riskOnly: true });
  });

  it('setFilters patches filters and an undefined value removes one', () => {
    window.history.replaceState(null, '', '/#deals?region=uk&rep=Jo&risk=1');
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.setFilters({ rep: undefined, stage: 'Commit' }));
    expect(window.location.hash).toBe('#deals?region=uk&stage=Commit&risk=1');
  });

  it('treats an empty rep as unset, matching what the hash re-parses to', () => {
    window.history.replaceState(null, '', '/#deals?region=uk&rep=Jo');
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.setFilters({ rep: '' }));
    expect('rep' in result.current.view).toBe(false);
    expect(window.location.hash).toBe('#deals?region=uk');
  });

  it('follows back/forward navigation', () => {
    const { result } = renderHook(() => useDashboardView());
    act(() => {
      window.history.replaceState(null, '', '/#cro?region=na');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.view).toEqual({ tab: 'cro', region: 'na' });
  });

  it('follows popstate on its own', () => {
    const { result } = renderHook(() => useDashboardView());
    act(() => {
      window.history.replaceState(null, '', '/#health?region=au');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.view).toEqual({ tab: 'health', region: 'au' });
  });

  it('goes back to the previous tab with the browser back button', async () => {
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.selectTab('cro'));
    act(() => result.current.selectTab('deals'));
    expect(result.current.view.tab).toBe('deals');
    act(() => window.history.back());
    await waitFor(() => expect(result.current.view.tab).toBe('cro'));
    expect(window.location.hash).toBe('#cro?region=all');
  });

  it('renders once when the browser fires both popstate and hashchange', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useDashboardView();
    });
    act(() => {
      window.history.replaceState(null, '', '/#cro?region=na');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const afterPop = renders;
    act(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(renders).toBe(afterPop);
  });

  it('does not add a history entry on mount', () => {
    const before = window.history.length;
    renderHook(() => useDashboardView());
    expect(window.history.length).toBe(before);
  });

  it('does not add a history entry when navigating to the current view', () => {
    window.history.replaceState(null, '', '/#deals?region=uk');
    const { result } = renderHook(() => useDashboardView());
    const before = window.history.length;
    act(() => result.current.selectTab('deals'));
    act(() => result.current.selectRegion('uk'));
    expect(window.history.length).toBe(before);
    act(() => result.current.selectTab('cro'));
    expect(window.history.length).toBe(before + 1);
  });
});
