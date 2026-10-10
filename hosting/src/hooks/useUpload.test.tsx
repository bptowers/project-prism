import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/firebase', () => ({ storage: {}, db: {} }));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
}));

import { uploadBytes } from 'firebase/storage';
import { onSnapshot } from 'firebase/firestore';
import { useUpload } from './useUpload';

const file = new File(['Name,Region\nAcme,UK\n'], 'export.csv', { type: 'text/csv' });

describe('useUpload', () => {
  beforeEach(() => {
    vi.mocked(uploadBytes).mockReset();
    vi.mocked(onSnapshot).mockReset();
  });

  it('reports a storage failure as an error instead of pretending the analysis completed', async () => {
    vi.mocked(uploadBytes).mockRejectedValue(new Error('storage/unauthorized'));
    const { result } = renderHook(() => useUpload());

    await act(async () => { await result.current.uploadAndAnalyze(file); });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('storage/unauthorized');
  });

  it('stays in analyzing until Firestore delivers a newer report — no timer declares success', async () => {
    vi.useFakeTimers();
    vi.mocked(uploadBytes).mockResolvedValue({} as never);
    vi.mocked(onSnapshot).mockReturnValue(vi.fn());
    const { result } = renderHook(() => useUpload());

    await act(async () => { await result.current.uploadAndAnalyze(file); });
    expect(result.current.state).toBe('analyzing');

    await act(async () => { vi.advanceTimersByTime(125_000); });
    expect(result.current.state).toBe('analyzing');
    expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(125);
    vi.useRealTimers();
  });

  it('completes when the listener sees a report created after the upload started', async () => {
    vi.mocked(uploadBytes).mockResolvedValue({} as never);
    const unsubscribe = vi.fn();
    let deliver: ((snap: unknown) => void) | undefined;
    vi.mocked(onSnapshot).mockImplementation(((_q: unknown, cb: (snap: unknown) => void) => {
      deliver = cb;
      return unsubscribe;
    }) as never);
    const { result } = renderHook(() => useUpload());

    await act(async () => { await result.current.uploadAndAnalyze(file); });
    const created = new Date(Date.now() + 60_000);
    act(() => {
      deliver?.({ empty: false, docs: [{ data: () => ({ createdAt: { toDate: () => created } }) }] });
    });

    expect(result.current.state).toBe('complete');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes the report listener on reset and on unmount', async () => {
    vi.mocked(uploadBytes).mockResolvedValue({} as never);
    const unsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(unsubscribe);

    const first = renderHook(() => useUpload());
    await act(async () => { await first.result.current.uploadAndAnalyze(file); });
    act(() => { first.result.current.reset(); });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(first.result.current.state).toBe('idle');
    expect(first.result.current.elapsedSeconds).toBe(0);

    const second = renderHook(() => useUpload());
    await act(async () => { await second.result.current.uploadAndAnalyze(file); });
    second.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('does not resume into analyzing when reset() runs while the upload is in flight', async () => {
    let finishUpload: () => void = () => undefined;
    vi.mocked(uploadBytes).mockImplementation(() => new Promise(resolve => { finishUpload = () => resolve({} as never); }));
    vi.mocked(onSnapshot).mockReturnValue(vi.fn());
    const { result } = renderHook(() => useUpload());

    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.uploadAndAnalyze(file); });
    expect(result.current.state).toBe('uploading');

    act(() => { result.current.reset(); });
    await act(async () => { finishUpload(); await pending; });

    expect(result.current.state).toBe('idle');
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});
