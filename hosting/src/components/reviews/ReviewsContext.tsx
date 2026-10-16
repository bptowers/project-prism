import React, { createContext, useContext, useMemo, useState } from 'react';
import { dealKey, reviewsApiFromMap, type DealReview, type ReviewsApi } from '@/lib/reviews';
import { riskScore } from '@/lib/dealMetrics';

const NOOP_REVIEWS: ReviewsApi = {
  getReview: () => undefined,
  isDone: () => false,
  isWorse: () => false,
  toggle: () => undefined,
  clearError: () => undefined,
};

/** App provides the Firestore-backed store (useSharedReviews); the default is inert. */
export const ReviewsContext = createContext<ReviewsApi>(NOOP_REVIEWS);

export function useReviews(): ReviewsApi {
  return useContext(ReviewsContext);
}

/** In-memory reviews for tests. */
export function MemoryReviewsProvider({ children, initial = {} }: { children: React.ReactNode; initial?: Record<string, DealReview> }) {
  const [reviews, setReviews] = useState(() => new Map(Object.entries(initial)));
  const api = useMemo(() => reviewsApiFromMap(reviews, {
    save: (deal) => setReviews(prev => new Map(prev).set(dealKey(deal), {
      reviewedBy: 'test@simprogroup.com',
      reviewedByName: 'Test User',
      reviewedAt: new Date('2026-10-15T09:00:00Z'),
      riskAtReview: riskScore(deal),
    })),
    remove: (deal) => setReviews(prev => {
      const next = new Map(prev);
      next.delete(dealKey(deal));
      return next;
    }),
  }), [reviews]);
  return <ReviewsContext.Provider value={api}>{children}</ReviewsContext.Provider>;
}
