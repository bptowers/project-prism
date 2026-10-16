import type { RiskDeal } from './types';
import { riskScore } from './dealMetrics';

/** One shared review, stored at /dealReviews/{dealKey}. */
export interface DealReview {
  reviewedBy: string;      // reviewer's email (rules enforce it is the signed-in user)
  reviewedByName: string;
  reviewedAt: Date | null; // null while the server timestamp is pending
  riskAtReview: number;    // riskScore when reviewed; lets us spot deals that got worse
}

export interface ReviewsApi {
  getReview(deal: RiskDeal): DealReview | undefined;
  /** Reviewed, and not worse since. */
  isDone(deal: RiskDeal): boolean;
  /** Reviewed, but its risk has risen since. Counts as not done. */
  isWorse(deal: RiskDeal): boolean;
  toggle(deal: RiskDeal): void;
  error?: string;
}

export interface ReviewWriter {
  save(deal: RiskDeal): void;
  remove(deal: RiskDeal): void;
}

/** Firestore-safe document id: '/' is encoded and reserved ids are prefixed. */
export function dealKey(deal: Pick<RiskDeal, 'opportunityId' | 'value'>): string {
  const encoded = encodeURIComponent((deal.opportunityId || deal.value || '').trim());
  const reserved = encoded === '' || encoded === '.' || encoded === '..' || /^__.*__$/.test(encoded);
  return reserved ? `k_${encoded}` : encoded;
}

export function isWorseSinceReview(deal: RiskDeal, review: DealReview): boolean {
  return riskScore(deal) > review.riskAtReview;
}

export function reviewsApiFromMap(reviews: Map<string, DealReview>, writer: ReviewWriter, error?: string): ReviewsApi {
  const getReview = (deal: RiskDeal) => reviews.get(dealKey(deal));
  const isWorse = (deal: RiskDeal) => {
    const review = getReview(deal);
    return !!review && isWorseSinceReview(deal, review);
  };
  const isDone = (deal: RiskDeal) => !!getReview(deal) && !isWorse(deal);
  return {
    getReview,
    isDone,
    isWorse,
    toggle: (deal) => (isDone(deal) ? writer.remove(deal) : writer.save(deal)),
    error,
  };
}
