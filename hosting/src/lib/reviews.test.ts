import { describe, it, expect, vi } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { dealKey, isWorseSinceReview, reviewsApiFromMap, WORSE_SINCE_REVIEW_POINTS, type DealReview } from './reviews';

const review = (riskAtReview: number): DealReview => ({
  reviewedBy: 'brad.towers@simprogroup.com', reviewedByName: 'Brad Towers', reviewedAt: new Date('2026-10-15T09:00:00Z'), riskAtReview,
});

describe('dealKey', () => {
  it('prefers the opportunity id and makes it safe as a Firestore doc id', () => {
    expect(dealKey(makeDeal({ opportunityId: '006ABC' }))).toBe('006ABC');
    expect(dealKey(makeDeal({ opportunityId: undefined, value: 'Acme / Renewal' }))).toBe('Acme%20%2F%20Renewal');
  });

  it('never produces a reserved id', () => {
    expect(dealKey(makeDeal({ opportunityId: '..' }))).toBe('k_..');
    expect(dealKey(makeDeal({ opportunityId: '__x__' }))).toBe('k___x__');
  });

  it('never throws on a lone surrogate', () => {
    expect(() => dealKey(makeDeal({ opportunityId: '\uD800Acme' }))).not.toThrow();
    expect(dealKey(makeDeal({ opportunityId: '\uD800Acme' }))).toBe('%EF%BF%BDAcme');
    expect(dealKey(makeDeal({ opportunityId: 'Acme\uDC00' }))).toBe('Acme%EF%BF%BD');
    expect(dealKey(makeDeal({ opportunityId: '\uD83D\uDE00' }))).toBe('%F0%9F%98%80'); // a valid pair is kept
  });

  it('handles empty and whitespace-only ids', () => {
    expect(dealKey(makeDeal({ opportunityId: '', value: '' }))).toBe('k_');
    expect(dealKey(makeDeal({ opportunityId: '   ', value: '  ' }))).toBe('k_');
    expect(dealKey(makeDeal({ opportunityId: '   ', value: 'Acme' }))).toBe('Acme');
  });
});

describe('isWorseSinceReview', () => {
  const atRisk = (risk: number) => makeDeal({ healthScore: 100 - risk });

  it('ignores run-to-run drift within a band', () => {
    expect(WORSE_SINCE_REVIEW_POINTS).toBe(10);
    expect(isWorseSinceReview(atRisk(70), review(70))).toBe(false);
    expect(isWorseSinceReview(atRisk(66), review(62))).toBe(false); // Red → Red, +4
    expect(isWorseSinceReview(atRisk(59), review(50))).toBe(false); // Yellow → Yellow, +9
    expect(isWorseSinceReview(atRisk(40), review(60))).toBe(false); // improved
  });

  it('is true when risk rose by the threshold or crossed into a worse band', () => {
    expect(isWorseSinceReview(atRisk(70), review(60))).toBe(true);  // +10
    expect(isWorseSinceReview(atRisk(62), review(58))).toBe(true);  // Yellow → Red
    expect(isWorseSinceReview(atRisk(31), review(30))).toBe(true);  // Green → Yellow
  });

  it('treats a malformed riskAtReview as worse so it re-enters the queue', () => {
    expect(isWorseSinceReview(atRisk(10), review(Number.NaN))).toBe(true);
    expect(isWorseSinceReview(atRisk(10), { ...review(0), riskAtReview: undefined as unknown as number })).toBe(true);
    expect(isWorseSinceReview(atRisk(10), review(Number.POSITIVE_INFINITY))).toBe(true);
  });
});

describe('reviewsApiFromMap', () => {
  it('reports done / worse and routes toggle to save or remove', () => {
    const done = makeDeal({ opportunityId: 'A', healthScore: 50 });  // risk 50
    const worse = makeDeal({ opportunityId: 'B', healthScore: 20 }); // risk 80
    const fresh = makeDeal({ opportunityId: 'C' });
    const writer = { save: vi.fn(), remove: vi.fn() };
    const api = reviewsApiFromMap(new Map([['A', review(50)], ['B', review(60)]]), writer);

    expect(api.isDone(done)).toBe(true);
    expect(api.isWorse(worse)).toBe(true);
    expect(api.isDone(worse)).toBe(false);
    expect(api.getReview(fresh)).toBeUndefined();

    api.toggle(done);
    expect(writer.remove).toHaveBeenCalledWith(done);
    api.toggle(worse); // a worse-since-review deal is re-reviewed, not cleared
    api.toggle(fresh);
    expect(writer.save).toHaveBeenCalledWith(worse);
    expect(writer.save).toHaveBeenCalledWith(fresh);
  });
});
