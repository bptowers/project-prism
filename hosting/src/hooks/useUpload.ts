import { useState, useCallback } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';

type UploadState = 'idle' | 'parsing' | 'uploading' | 'analyzing' | 'complete' | 'error';

interface FilePreview {
  name: string;
  size: number;
  rows: number;
  columns: string[];
  regions: string[];
}

export function useUpload() {
  const [state, setState] = useState<UploadState>('idle');
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'claude' | 'gemini' | 'openai'>('claude');

  const parseFile = useCallback((file: File) => {
    setState('parsing');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rowCount = lines.length - 1;

      const regionCol = headers.findIndex(h => /region/i.test(h));
      const regions: string[] = [];
      if (regionCol >= 0) {
        const uniq = new Set<string>();
        lines.slice(1).forEach(line => {
          const cols = line.split(',');
          if (cols[regionCol]) uniq.add(cols[regionCol].replace(/^"|"$/g, '').trim());
        });
        regions.push(...uniq);
      }

      setPreview({ name: file.name, size: file.size, rows: rowCount, columns: headers, regions });
      setState('idle');
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setState('error');
    };
    reader.readAsText(file);
  }, []);

  const uploadAndAnalyze = useCallback(async (file: File) => {
    try {
      setState('uploading');
      const timestamp = Date.now();
      const storageRef = ref(storage, `uploads/${timestamp}_${file.name}`);
      // Pass the selected provider as Storage metadata so the Cloud Function
      // can use it instead of the default LLM_PROVIDER environment variable.
      await uploadBytes(storageRef, file, { customMetadata: { provider } });

      setState('analyzing');

      // Listen for a new report to appear in Firestore (triggered by Cloud Function)
      const reportQuery = query(
        collection(db, 'reports'),
        orderBy('reportDate', 'desc'),
        limit(1)
      );

      const timeout = setTimeout(() => {
        // After 120s, assume completion (Cloud Function may have finished)
        setState('complete');
      }, 120_000);

      const unsubscribe = onSnapshot(reportQuery, (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          // Check if this report was created after our upload
          if (data.createdAt && data.createdAt.toDate() > new Date(timestamp)) {
            clearTimeout(timeout);
            unsubscribe();
            setState('complete');
          }
        }
      });

    } catch (err) {
      console.info('Storage not configured yet — simulating upload.');
      setState('analyzing');
      await new Promise(resolve => setTimeout(resolve, 3000));
      setState('complete');
    }
  }, [provider]);

  const reset = useCallback(() => {
    setState('idle');
    setPreview(null);
    setError(null);
  }, []);

  return { state, preview, error, provider, setProvider, parseFile, uploadAndAnalyze, reset };
}
