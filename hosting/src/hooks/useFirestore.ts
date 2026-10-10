import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReportDocument, RiskDeal } from '@/lib/types';
import { injectDeals } from '@/lib/injectDeals';

export function useLatestReport() {
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('reportDate', 'desc'), limit(1));

    // Each snapshot kicks off a deals fetch. Enrichment phases rewrite the
    // report doc several times per run, so fetches overlap; only the latest
    // one may publish, or a stale result can overwrite a newer report.
    let latestSeq = 0;
    let active = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const seq = ++latestSeq;
        if (snapshot.empty) {
          setLoading(false);
          return;
        }

        const docData = snapshot.docs[0];
        const baseReport = { id: docData.id, ...docData.data() } as ReportDocument;

        // Fetch all deals from the subcollection and inject into transformed.risks.
        // This removes the 150-deal cap that was imposed by the 1 MiB document limit.
        getDocs(collection(db, 'reports', docData.id, 'deals'))
          .then((dealsSnap) => {
            if (!active || seq !== latestSeq) return;
            const deals = dealsSnap.docs.map(d => d.data() as RiskDeal);
            setReport(injectDeals(baseReport, deals));
          })
          .catch((err: unknown) => {
            if (!active || seq !== latestSeq) return;
            const message = err instanceof Error ? err.message : String(err);
            console.warn('[useLatestReport] Deals subcollection fetch failed, using embedded risks:', err);
            setReport({ ...baseReport, dealsError: message });
          })
          .finally(() => {
            if (active && seq === latestSeq) setLoading(false);
          });
      },
      (err) => {
        console.error('Firestore query error:', err);
        setError('Firestore query failed');
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
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
