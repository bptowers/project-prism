import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

type Claims = { email: string; email_verified: boolean; name?: string };

const BRAD: Claims = { email: 'brad.towers@simprogroup.com', email_verified: true, name: 'Brad Towers' };
const ANN: Claims = { email: 'ann@simpro.au', email_verified: true, name: 'Ann Lee' };
const NO_NAME: Claims = { email: 'sam@simpro.us', email_verified: true };
const UPPER_CASE: Claims = { email: 'Brad@SIMPROGROUP.COM', email_verified: true };
const LONG_NAME: Claims = { email: 'long@simpro.us', email_verified: true, name: 'x'.repeat(201) };
const OUTSIDER: Claims = { email: 'someone@gmail.com', email_verified: true };
const UNVERIFIED: Claims = { email: 'new.hire@simprogroup.com', email_verified: false };

let env: RulesTestEnvironment;

const asUser = (claims: Claims) =>
  env.authenticatedContext(claims.email, claims).firestore();

/** A review as the client writes it: the token's name, or the email when there is none. */
const review = (user: Claims, extra: Record<string, unknown> = {}) => ({
  reviewedBy: user.email,
  reviewedByName: user.name ?? user.email,
  reviewedAt: serverTimestamp(),
  riskAtReview: 72,
  ...extra,
});

const seedBradReview = () =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'dealReviews/OPP-1'), { reviewedBy: BRAD.email, reviewedByName: 'Brad Towers', reviewedAt: new Date(), riskAtReview: 50 });
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
    await assertSucceeds(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD)));
  });

  it('lets an allowlisted user read reviews', async () => {
    await assertSucceeds(getDoc(doc(asUser(ANN), 'dealReviews/OPP-1')));
  });

  it("rejects stamping someone else's email", async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { reviewedBy: ANN.email })));
  });

  it('rejects extra or missing fields', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { isAdmin: true })));
    const { riskAtReview: _omit, ...missing } = review(BRAD);
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), missing));
  });

  it('rejects a client-supplied timestamp and an out-of-range risk', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { reviewedAt: new Date() })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { riskAtReview: 150 })));
  });

  it('rejects off-domain, unverified and signed-out users', async () => {
    await assertFails(setDoc(doc(asUser(OUTSIDER), 'dealReviews/OPP-1'), review(OUTSIDER)));
    await assertFails(getDoc(doc(asUser(OUTSIDER), 'dealReviews/OPP-1')));
    await assertFails(setDoc(doc(asUser(UNVERIFIED), 'dealReviews/OPP-1'), review(UNVERIFIED)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'dealReviews/OPP-1')));
  });

  it('lets any allowlisted user un-tick a review', async () => {
    await seedBradReview();
    await assertSucceeds(deleteDoc(doc(asUser(ANN), 'dealReviews/OPP-1')));
  });

  it('rejects wrong field types, an oversize name and a negative risk', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { reviewedByName: 123 })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { reviewedByName: ['x'] })));
    await assertFails(setDoc(doc(asUser(LONG_NAME), 'dealReviews/OPP-1'), review(LONG_NAME)));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { riskAtReview: '72' })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { riskAtReview: Timestamp.now() })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD, { riskAtReview: -1 })));
  });

  it("lets another user re-review a deal under their own email, never under the previous reviewer's", async () => {
    await seedBradReview();
    await assertFails(setDoc(doc(asUser(ANN), 'dealReviews/OPP-1'), review(ANN, { reviewedBy: BRAD.email })));
    await assertSucceeds(setDoc(doc(asUser(ANN), 'dealReviews/OPP-1'), review(ANN)));
  });

  it('rejects un-ticks from off-domain, unverified and signed-out users', async () => {
    await seedBradReview();
    await assertFails(deleteDoc(doc(asUser(OUTSIDER), 'dealReviews/OPP-1')));
    await assertFails(deleteDoc(doc(asUser(UNVERIFIED), 'dealReviews/OPP-1')));
    await assertFails(deleteDoc(doc(env.unauthenticatedContext().firestore(), 'dealReviews/OPP-1')));
  });

  it("rejects a display name other than the token's, on create and on re-review", async () => {
    await assertFails(setDoc(doc(asUser(ANN), 'dealReviews/OPP-1'), review(ANN, { reviewedByName: 'Brad Towers' })));
    await seedBradReview();
    await assertFails(setDoc(doc(asUser(ANN), 'dealReviews/OPP-1'), review(ANN, { reviewedByName: 'Brad Towers' })));
  });

  it("accepts the token's name, or the email when the token has no name", async () => {
    await assertSucceeds(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD)));
    await assertSucceeds(setDoc(doc(asUser(NO_NAME), 'dealReviews/OPP-2'), review(NO_NAME)));
    await assertFails(setDoc(doc(asUser(NO_NAME), 'dealReviews/OPP-3'), review(NO_NAME, { reviewedByName: 'Sam' })));
  });

  it('allows an upper-case company domain, stamped with the exact token email', async () => {
    await assertSucceeds(setDoc(doc(asUser(UPPER_CASE), 'dealReviews/OPP-1'), review(UPPER_CASE)));
    await assertFails(setDoc(doc(asUser(UPPER_CASE), 'dealReviews/OPP-2'), review(UPPER_CASE, { reviewedBy: 'brad@simprogroup.com' })));
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
