import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

const BRAD = { email: 'brad.towers@simprogroup.com', email_verified: true };
const ANN = { email: 'ann@simpro.au', email_verified: true };
const OUTSIDER = { email: 'someone@gmail.com', email_verified: true };
const UNVERIFIED = { email: 'new.hire@simprogroup.com', email_verified: false };

let env: RulesTestEnvironment;

const asUser = (claims: { email: string; email_verified: boolean }) =>
  env.authenticatedContext(claims.email, claims).firestore();

const review = (email: string, extra: Record<string, unknown> = {}) => ({
  reviewedBy: email,
  reviewedByName: 'Brad Towers',
  reviewedAt: serverTimestamp(),
  riskAtReview: 72,
  ...extra,
});

const seedBradReview = () =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'dealReviews/OPP-1'), { reviewedBy: BRAD.email, reviewedByName: 'Brad', reviewedAt: new Date(), riskAtReview: 50 });
  });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-prism',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('/dealReviews', () => {
  it('lets an allowlisted user stamp a review with their own email', async () => {
    await assertSucceeds(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email)));
  });

  it('lets an allowlisted user read reviews', async () => {
    await assertSucceeds(getDoc(doc(asUser(ANN), 'dealReviews/OPP-1')));
  });

  it("rejects stamping someone else's email", async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(ANN.email)));
  });

  it('rejects extra or missing fields', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { isAdmin: true })));
    const { riskAtReview: _omit, ...missing } = review(BRAD.email);
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), missing));
  });

  it('rejects a client-supplied timestamp and an out-of-range risk', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { reviewedAt: new Date() })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { riskAtReview: 150 })));
  });

  it('rejects off-domain, unverified and signed-out users', async () => {
    await assertFails(setDoc(doc(asUser(OUTSIDER), 'dealReviews/OPP-1'), review(OUTSIDER.email)));
    await assertFails(getDoc(doc(asUser(OUTSIDER), 'dealReviews/OPP-1')));
    await assertFails(setDoc(doc(asUser(UNVERIFIED), 'dealReviews/OPP-1'), review(UNVERIFIED.email)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'dealReviews/OPP-1')));
  });

  it('lets any allowlisted user un-tick a review', async () => {
    await seedBradReview();
    await assertSucceeds(deleteDoc(doc(asUser(ANN), 'dealReviews/OPP-1')));
  });

  it('rejects wrong field types, an oversize name and a negative risk', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { reviewedByName: 123 })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { reviewedByName: 'x'.repeat(201) })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { riskAtReview: '72' })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { riskAtReview: -1 })));
  });

  it("lets another user re-review a deal under their own email, never under the previous reviewer's", async () => {
    await seedBradReview();
    await assertFails(setDoc(doc(asUser(ANN), 'dealReviews/OPP-1'), review(BRAD.email)));
    await assertSucceeds(setDoc(doc(asUser(ANN), 'dealReviews/OPP-1'), review(ANN.email)));
  });

  it('lets an allowlisted user list all reviews, and nobody else', async () => {
    await seedBradReview();
    await assertSucceeds(getDocs(collection(asUser(ANN), 'dealReviews')));
    await assertFails(getDocs(collection(asUser(OUTSIDER), 'dealReviews')));
  });
});

describe('everything else stays read-only for clients', () => {
  it('still denies client writes to reports', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'reports/2026-10-15'), { hacked: true }));
  });
});
