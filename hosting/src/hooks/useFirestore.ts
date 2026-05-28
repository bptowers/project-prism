import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReportDocument, RiskDeal } from '@/lib/types';

export function useLatestReport() {
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('reportDate', 'desc'), limit(1));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          const baseReport = { id: docData.id, ...docData.data() } as ReportDocument;

          // Fetch all deals from the subcollection and inject into transformed.risks.
          // This removes the 150-deal cap that was imposed by the 1 MiB document limit.
          // Falls back gracefully to whatever risks are in the document for old reports.
          getDocs(collection(db, 'reports', docData.id, 'deals'))
            .then((dealsSnap) => {
              if (!dealsSnap.empty && baseReport.transformed) {
                const allDeals = dealsSnap.docs.map(d => d.data() as RiskDeal);

                // Inject full deal list into the 'all' region
                if (baseReport.transformed['all']) {
                  baseReport.transformed['all'].risks = allDeals;
                }

                // Inject per-region deals into each regional slice
                const byRegion: Record<string, RiskDeal[]> = {};
                for (const deal of allDeals) {
                  const r = deal.region || 'unknown';
                  if (!byRegion[r]) byRegion[r] = [];
                  byRegion[r].push(deal);
                }
                for (const [region, deals] of Object.entries(byRegion)) {
                  if (baseReport.transformed[region]) {
                    baseReport.transformed[region].risks = deals;
                  }
                }
              }
              setReport(baseReport);
            })
            .catch((err) => {
              console.warn('[useLatestReport] Deals subcollection fetch failed, using embedded risks:', err);
              setReport(baseReport);
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firestore query error:', err);
        setError('Firestore query failed');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { report, loading, error };
}

export function useReportHistory() {
  const [reports, setReports] = useState<ReportDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('reportDate', 'desc'), limit(10));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ReportDocument));
        setLoading(false);
      },
      (err) => {
        console.error('Firestore history query error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { reports, loading };
}
