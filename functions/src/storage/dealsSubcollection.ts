/**
 * Project Prism - /reports/{date}/deals writer
 *
 * The full, uncapped per-deal set lives in a subcollection so the main report
 * doc stays under Firestore's 1 MiB limit. Reports are keyed by date, so a
 * second run on the same day writes into the same subcollection: deals from
 * the earlier run that dropped out of the new pull are deleted once the new
 * set is in place (write first, so readers never see an empty list).
 */

import type { Firestore } from "firebase-admin/firestore";

const BATCH_SIZE = 500;

export async function writeDealsSubcollection(
  db: Firestore,
  reportDate: string,
  deals: Array<Record<string, unknown>>
): Promise<{ written: number; removed: number }> {
  if (!deals.length) return { written: 0, removed: 0 };
  const dealsRef = db.collection("reports").doc(reportDate).collection("deals");

  const writtenIds = new Set<string>();
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    const batch = db.batch();
    deals.slice(i, i + BATCH_SIZE).forEach((deal, j) => {
      const dealId = String(deal.opportunityId || `deal-${deal.id ?? i + j}`);
      writtenIds.add(dealId);
      batch.set(dealsRef.doc(dealId), deal);
    });
    await batch.commit();
  }

  const stale = (await dealsRef.listDocuments()).filter((ref) => !writtenIds.has(ref.id));
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = db.batch();
    stale.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  console.log(
    `[writeDealsSubcollection] wrote ${writtenIds.size} deals to /reports/${reportDate}/deals` +
      (stale.length ? `, removed ${stale.length} left over from an earlier run today` : "")
  );
  return { written: writtenIds.size, removed: stale.length };
}
