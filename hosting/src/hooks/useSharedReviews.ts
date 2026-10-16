import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { riskScore } from '@/lib/dealMetrics';
import type { RiskDeal } from '@/lib/types';
import { dealKey, reviewsApiFromMap, type DealReview, type ReviewsApi } from '@/lib/reviews';

const COLLECTION = 'dealReviews';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function readDate(value: unknown): Date | null {
  const at = value as { toDate?: () => Date } | null | undefined;
  try {
    return at && typeof at.toDate === 'function' ? at.toDate() : null;
  } catch {
    return null;
  }
}

/** A malformed riskAtReview becomes NaN, which isWorseSinceReview treats as worse. */
function toReview(data: Record<string, unknown> | undefined): DealReview | undefined {
  if (!data || typeof data.reviewedBy !== 'string') return undefined;
  return {
    reviewedBy: data.reviewedBy,
    reviewedByName: typeof data.reviewedByName === 'string' && data.reviewedByName ? data.reviewedByName : data.reviewedBy,
    reviewedAt: readDate(data.reviewedAt),
    riskAtReview: typeof data.riskAtReview === 'number' ? data.riskAtReview : Number.NaN,
  };
}

/** The rule needs a number in 0-100; an unscoreable deal is recorded at maximum risk. */
function riskForRule(deal: RiskDeal): number {
  const risk = riskScore(deal);
  return Number.isFinite(risk) ? Math.round(Math.min(100, Math.max(0, risk))) : 100;
}

/** The rule compares against the token's name claim, which user.displayName can lag behind. */
async function reviewerName(user: User & { email: string }): Promise<string> {
  const { claims } = await user.getIdTokenResult();
  return typeof claims.name === 'string' && claims.name ? claims.name : user.email;
}

/**
 * Team-wide deal reviews, live from Firestore. Writes are allowed by a narrow
 * rule in firestore.rules (own email, token name, server timestamp, fixed fields).
 */
export function useSharedReviews(): ReviewsApi {
  const [reviews, setReviews] = useState<Map<string, DealReview>>(() => new Map());
  // Kept apart so a snapshot (which follows a rejected write's rollback) can't wipe a write error.
  const [listenError, setListenError] = useState<string | undefined>();
  const [writeError, setWriteError] = useState<string | undefined>();

  useEffect(() => onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const next = new Map<string, DealReview>();
      snapshot.forEach((d) => {
        const review = toReview(d.data());
        if (review) next.set(d.id, review);
      });
      setReviews(next);
      setListenError(undefined);
    },
    (err) => setListenError(`Couldn't load reviews: ${err.message}`),
  ), []);

  return useMemo(() => {
    const save = async (deal: RiskDeal) => {
      const user = auth.currentUser;
      if (!user?.email) {
        setWriteError('Sign in again to mark deals as reviewed.');
        return;
      }
      try {
        await setDoc(doc(db, COLLECTION, dealKey(deal)), {
          reviewedBy: user.email,
          reviewedByName: await reviewerName(user as User & { email: string }),
          reviewedAt: serverTimestamp(),
          riskAtReview: riskForRule(deal),
        });
        setWriteError(undefined);
      } catch (err) {
        setWriteError(`Couldn't save the review: ${messageOf(err)}`);
      }
    };
    const remove = async (deal: RiskDeal) => {
      try {
        await deleteDoc(doc(db, COLLECTION, dealKey(deal)));
        setWriteError(undefined);
      } catch (err) {
        setWriteError(`Couldn't remove the review: ${messageOf(err)}`);
      }
    };
    return reviewsApiFromMap(reviews, {
      save: (deal) => void save(deal),
      remove: (deal) => void remove(deal),
    }, writeError ?? listenError);
  }, [reviews, writeError, listenError]);
}
