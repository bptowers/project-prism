import { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * The rule needs a number in 0-100; an unscoreable deal is recorded at maximum risk.
 * Not rounded: 30.4 -> 30 would cross the Green/Yellow line and read as worse at once.
 */
function riskForRule(deal: RiskDeal): number {
  const risk = riskScore(deal);
  return Number.isFinite(risk) ? Math.min(100, Math.max(0, risk)) : 100;
}

/** Mirrors the rule's token.get('name', email); user.displayName can lag behind the token. */
async function reviewerName(user: User & { email: string }): Promise<string> {
  const { claims } = await user.getIdTokenResult();
  return typeof claims.name === 'string' ? claims.name : user.email;
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
  // Only the latest write may set writeError, so an older one settling late can't leave a stale error.
  const writeSeq = useRef(0);

  // Firestore ends the listener after its error callback: keep the last good map and the error until reload.
  useEffect(() => onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const next = new Map<string, DealReview>();
      snapshot.forEach((d) => {
        const review = toReview(d.data());
        if (review) next.set(d.id, review);
      });
      setReviews(next);
    },
    (err) => setListenError(`Couldn't load reviews: ${err.message}. Reload the page to try again.`),
  ), []);

  return useMemo(() => {
    const write = async (failure: string, op: () => Promise<void>) => {
      const seq = ++writeSeq.current;
      setWriteError(undefined);
      try {
        await op();
      } catch (err) {
        if (seq === writeSeq.current) setWriteError(`${failure}: ${messageOf(err)}`);
      }
    };
    const save = (deal: RiskDeal) => write("Couldn't save the review", async () => {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('sign in again to mark deals as reviewed.');
      await setDoc(doc(db, COLLECTION, dealKey(deal)), {
        reviewedBy: user.email,
        reviewedByName: await reviewerName(user as User & { email: string }),
        reviewedAt: serverTimestamp(),
        riskAtReview: riskForRule(deal),
      });
    });
    const remove = (deal: RiskDeal) => write("Couldn't remove the review", () => deleteDoc(doc(db, COLLECTION, dealKey(deal))));
    return {
      ...reviewsApiFromMap(reviews, {
        save: (deal) => void save(deal),
        remove: (deal) => void remove(deal),
      }, writeError ?? listenError),
      // The user has seen it: dismissing a listener error hides it until reload, the listener stays ended.
      clearError: () => {
        setWriteError(undefined);
        setListenError(undefined);
      },
    };
  }, [reviews, writeError, listenError]);
}
