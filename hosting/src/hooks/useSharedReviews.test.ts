import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';

type SnapDoc = { id: string; data: () => Record<string, unknown> };
let emit: (docs: SnapDoc[]) => void = () => undefined;
let fail: (err: Error) => void = () => undefined;
let listenedTo: unknown;
const unsubscribe = vi.fn();
const setDoc = vi.fn((..._args: unknown[]) => Promise.resolve());
const deleteDoc = vi.fn((..._args: unknown[]) => Promise.resolve());
const getIdTokenResult = vi.fn(() => Promise.resolve({ claims: { name: 'Brad Towers' } as Record<string, unknown> }));
const currentUser = { email: 'brad.towers@simprogroup.com', displayName: 'Stale Name', getIdTokenResult };
const auth: { currentUser: typeof currentUser | null } = { currentUser };

vi.mock('@/lib/firebase', () => ({
  db: {},
  get auth() { return auth; },
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string, id: string) => ({ path: `${path}/${id}` }),
  serverTimestamp: () => 'SERVER_TS',
  setDoc: (...args: unknown[]) => setDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  onSnapshot: (
    ref: unknown,
    next: (snap: { forEach: (cb: (d: SnapDoc) => void) => void }) => void,
    error: (err: Error) => void,
  ) => {
    listenedTo = ref;
    emit = (docs) => next({ forEach: (cb) => docs.forEach(cb) });
    fail = error;
    return unsubscribe;
  },
}));

import { useSharedReviews } from './useSharedReviews';

beforeEach(() => {
  setDoc.mockReset().mockImplementation(() => Promise.resolve());
  deleteDoc.mockReset().mockImplementation(() => Promise.resolve());
  getIdTokenResult.mockReset().mockImplementation(() => Promise.resolve({ claims: { name: 'Brad Towers' } }));
  auth.currentUser = currentUser;
  unsubscribe.mockReset();
  listenedTo = undefined;
});

const reviewDoc = (id: string, data: Record<string, unknown>): SnapDoc => ({ id, data: () => data });

describe('useSharedReviews', () => {
  it('listens to the dealReviews collection and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSharedReviews());
    expect(listenedTo).toEqual({ path: 'dealReviews' });
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('saves a review stamped with the signed-in user and current risk', async () => {
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9', healthScore: 30 });
    act(() => result.current.toggle(deal));
    await waitFor(() => expect(setDoc).toHaveBeenCalledWith(
      { path: 'dealReviews/OPP-9' },
      { reviewedBy: 'brad.towers@simprogroup.com', reviewedByName: 'Brad Towers', reviewedAt: 'SERVER_TS', riskAtReview: 70 },
    ));
  });

  it('takes the reviewer name from the ID token, not displayName', async () => {
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9' })));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1]).toMatchObject({ reviewedByName: 'Brad Towers' });
  });

  it.each([
    ['missing', {}],
    ['not a string', { name: 42 }],
  ])('falls back to the email when the token name is %s', async (_label, claims) => {
    getIdTokenResult.mockImplementation(() => Promise.resolve({ claims }));
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9' })));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1]).toMatchObject({ reviewedByName: 'brad.towers@simprogroup.com' });
  });

  it('writes an empty token name as-is, matching the rule', async () => {
    getIdTokenResult.mockImplementation(() => Promise.resolve({ claims: { name: '' } }));
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9' })));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1]).toMatchObject({ reviewedByName: '' });
  });

  it.each([
    [-12.4, 100],
    [0.6, 99.4],
    [87.6, 12.4],
  ])('writes the risk clamped to 0-100 and unrounded (healthScore %s -> risk %s)', async (healthScore, risk) => {
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9', healthScore })));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect((setDoc.mock.calls[0][1] as { riskAtReview: number }).riskAtReview).toBeCloseTo(risk, 10);
  });

  it('does not show a deal with fractional health as worse right after review', async () => {
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9', healthScore: 69.6 });
    act(() => result.current.toggle(deal));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const written = setDoc.mock.calls[0][1] as Record<string, unknown>;
    act(() => emit([reviewDoc('OPP-9', { ...written, reviewedAt: null })]));
    expect(result.current.isWorse(deal)).toBe(false);
    expect(result.current.isDone(deal)).toBe(true);
  });

  it('writes the maximum risk when the score is not a number', async () => {
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9', healthScore: Number.NaN })));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1]).toMatchObject({ riskAtReview: 100 });
  });

  it('reads reviews from the snapshot and deletes on un-tick', async () => {
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9', healthScore: 30 });
    act(() => emit([reviewDoc('OPP-9', { reviewedBy: 'ann@simpro.au', reviewedByName: 'Ann', reviewedAt: { toDate: () => new Date('2026-10-14') }, riskAtReview: 70 })]));
    expect(result.current.isDone(deal)).toBe(true);
    expect(result.current.getReview(deal)?.reviewedByName).toBe('Ann');
    expect(result.current.getReview(deal)?.reviewedAt).toEqual(new Date('2026-10-14'));

    await act(async () => result.current.toggle(deal));
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'dealReviews/OPP-9' });
  });

  it('ignores malformed documents', () => {
    const { result } = renderHook(() => useSharedReviews());
    act(() => emit([reviewDoc('OPP-1', { reviewedBy: 42 })]));
    expect(result.current.getReview(makeDeal({ opportunityId: 'OPP-1' }))).toBeUndefined();
  });

  it('keeps a doc with a malformed riskAtReview so it counts as worse', () => {
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-2' });
    act(() => emit([reviewDoc('OPP-2', { reviewedBy: 'ann@simpro.au', riskAtReview: 'high', reviewedAt: 'yesterday' })]));
    const review = result.current.getReview(deal);
    expect(review?.riskAtReview).toBeNaN();
    expect(review?.reviewedByName).toBe('ann@simpro.au');
    expect(review?.reviewedAt).toBeNull();
    expect(result.current.isWorse(deal)).toBe(true);
    expect(result.current.isDone(deal)).toBe(false);
  });

  it('does not throw when a timestamp cannot be read', () => {
    const { result } = renderHook(() => useSharedReviews());
    const reviewedAt = { toDate: () => { throw new Error('bad timestamp'); } };
    act(() => emit([reviewDoc('OPP-3', { reviewedBy: 'ann@simpro.au', riskAtReview: 40, reviewedAt })]));
    expect(result.current.getReview(makeDeal({ opportunityId: 'OPP-3' }))?.reviewedAt).toBeNull();
  });

  it('surfaces a rejected save as an error that a later snapshot does not clear', async () => {
    setDoc.mockImplementation(() => Promise.reject(new Error('Missing or insufficient permissions.')));
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9' })));
    await waitFor(() => expect(result.current.error).toMatch(/insufficient permissions/));

    act(() => emit([]));
    expect(result.current.error).toMatch(/insufficient permissions/);
  });

  it('surfaces a rejected delete as an error', async () => {
    deleteDoc.mockImplementation(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9', healthScore: 30 });
    act(() => emit([reviewDoc('OPP-9', { reviewedBy: 'ann@simpro.au', riskAtReview: 70 })]));
    act(() => result.current.toggle(deal));
    await waitFor(() => expect(result.current.error).toMatch(/offline/));
  });

  it('surfaces a failed token read as an error and does not write', async () => {
    getIdTokenResult.mockImplementation(() => Promise.reject(new Error('network down')));
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9' })));
    await waitFor(() => expect(result.current.error).toMatch(/network down/));
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('clears a write error as soon as the next write starts', async () => {
    setDoc.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9' });
    act(() => result.current.toggle(deal));
    await waitFor(() => expect(result.current.error).toMatch(/offline/));

    setDoc.mockImplementationOnce(() => new Promise(() => undefined)); // never settles
    act(() => result.current.toggle(deal));
    expect(result.current.error).toBeUndefined();
  });

  it('clearError() dismisses a write error', async () => {
    setDoc.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9' })));
    await waitFor(() => expect(result.current.error).toMatch(/offline/));

    act(() => result.current.clearError?.());
    expect(result.current.error).toBeUndefined();
  });

  it('ignores an earlier failing write that settles after a later successful one', async () => {
    let rejectFirst: (err: Error) => void = () => undefined;
    setDoc
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockImplementationOnce(() => Promise.resolve());
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-1' })));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-2' })));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(2));

    await act(async () => rejectFirst(new Error('offline')));
    expect(result.current.error).toBeUndefined();
  });

  it('asks the user to sign in again when there is no signed-in email', async () => {
    auth.currentUser = null;
    const { result } = renderHook(() => useSharedReviews());
    act(() => result.current.toggle(makeDeal({ opportunityId: 'OPP-9' })));
    await waitFor(() => expect(result.current.error).toMatch(/sign in again/i));
    expect(setDoc).not.toHaveBeenCalled();
  });

  // Firestore ends a listener after its error callback, so no further snapshots arrive.
  it('surfaces a listener error and keeps the last good reviews', () => {
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9', healthScore: 30 });
    act(() => emit([reviewDoc('OPP-9', { reviewedBy: 'ann@simpro.au', riskAtReview: 70 })]));
    act(() => fail(new Error('permission-denied')));
    expect(result.current.error).toMatch(/permission-denied/);
    expect(result.current.error).toMatch(/reload/i);
    expect(result.current.isDone(deal)).toBe(true);
  });
});
