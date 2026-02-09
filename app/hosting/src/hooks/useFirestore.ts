import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReportDocument } from '@/lib/types';

export function useLatestReport() {
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLatest() {
      try {
        const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setReport({ id: docData.id, ...docData.data() } as ReportDocument);
        }
      } catch (err) {
        // Firestore not configured yet — fall back to sample data
        setError('Firestore not configured — using sample data');
        console.info('Firestore not configured yet. Using sample data.');
      } finally {
        setLoading(false);
      }
    }
    fetchLatest();
  }, []);

  return { report, loading, error };
}

export function useReportHistory() {
  const [reports, setReports] = useState<ReportDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ReportDocument));
      } catch {
        console.info('Firestore not configured yet.');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return { reports, loading };
}
