import { describe, it, expect, vi } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { dealKey, isWorseSinceReview, reviewsApiFromMap, type DealReview } from './reviews';

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
});

describe('isWorseSinceReview', () => {
  it('is true only when risk rose after the review', () => {
    const deal = makeDeal({ healthScore: 30 }); // risk 70
    expect(isWorseSinceReview(deal, review(60))).toBe(true);
    expect(isWorseSinceReview(deal, review(70))).toBe(false);
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
