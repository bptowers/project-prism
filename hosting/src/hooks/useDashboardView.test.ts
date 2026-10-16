import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardView, LAST_REGION_KEY } from './useDashboardView';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
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
});
