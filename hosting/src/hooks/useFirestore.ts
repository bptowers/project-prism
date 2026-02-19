import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReportDocument } from '@/lib/types';

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
          setReport({ id: docData.id, ...docData.data() } as ReportDocument);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firestore query error:', err);
        setError('Firestore query failed — using sample data');
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
