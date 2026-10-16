import type { RiskDeal } from './types';
import { bandForRisk, riskScore, type RiskBand } from './dealMetrics';

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
  /** Dismiss the current error (write or listener). */
  clearError?(): void;
}

export interface ReviewWriter {
  save(deal: RiskDeal): void;
  remove(deal: RiskDeal): void;
}

/** encodeURIComponent throws on a lone surrogate; on failure, retry with each one swapped for U+FFFD. */
function safeEncode(raw: string): string {
  try {
    return encodeURIComponent(raw);
  } catch {
    return encodeURIComponent(raw.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD'));
  }
}

/** Firestore-safe document id: '/' is encoded and reserved ids are prefixed. */
export function dealKey(deal: Pick<RiskDeal, 'opportunityId' | 'value'>): string {
  const encoded = safeEncode(deal.opportunityId?.trim() || deal.value?.trim() || '');
  const reserved = encoded === '' || encoded === '.' || encoded === '..' || /^__.*__$/.test(encoded);
  return reserved ? `k_${encoded}` : encoded;
}

/**
 * How far risk must rise before a reviewed deal re-enters the queue. The LLM
 * health score drifts a few points run to run, and deals without one gain 2
 * risk per stalled day, so any rise at all would undo most reviews each run.
 */
export const WORSE_SINCE_REVIEW_POINTS = 10;

const BAND_RANK: Record<RiskBand, number> = { Green: 0, Yellow: 1, Red: 2 };

/** Risk rose by WORSE_SINCE_REVIEW_POINTS or crossed into a worse band. A malformed riskAtReview counts as worse. */
export function isWorseSinceReview(deal: RiskDeal, review: DealReview): boolean {
  if (!Number.isFinite(review.riskAtReview)) return true;
  const risk = riskScore(deal);
  return risk - review.riskAtReview >= WORSE_SINCE_REVIEW_POINTS
    || BAND_RANK[bandForRisk(risk)] > BAND_RANK[bandForRisk(review.riskAtReview)];
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
