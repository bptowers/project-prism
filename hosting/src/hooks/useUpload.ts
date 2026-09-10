import { useState, useCallback, useEffect, useRef } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { parseCsvPreview } from '@/lib/csvPreview';

type UploadState = 'idle' | 'parsing' | 'uploading' | 'analyzing' | 'complete' | 'error';

interface FilePreview {
  name: string;
  size: number;
  rows: number;
  columns: string[];
  regions: string[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useUpload() {
  const [state, setState] = useState<UploadState>('idle');
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'claude' | 'gemini' | 'openai'>('claude');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // The Firestore listener that detects the new report. Held in a ref so
  // reset() and unmount can always tear it down.
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stopListening = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  useEffect(() => stopListening, [stopListening]);

  // Elapsed-time ticker while an upload or analysis is in flight. This is a
  // clock, not a progress bar — only the report listener may declare success.
  useEffect(() => {
    if (startedAt === null || (state !== 'uploading' && state !== 'analyzing')) return;
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, state]);

  const parseFile = useCallback((file: File) => {
    setState('parsing');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const summary = parseCsvPreview(text);
        setPreview({ name: file.name, size: file.size, ...summary });
        setState('idle');
      } catch (err) {
        setError(errorMessage(err));
        setState('error');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setState('error');
    };
    reader.readAsText(file);
  }, []);

  const uploadAndAnalyze = useCallback(async (file: File) => {
    const started = Date.now();
    setError(null);
    setStartedAt(started);
    setState('uploading');

    try {
      const storageRef = ref(storage, `uploads/${started}_${file.name}`);
      // Pass the selected provider as Storage metadata so the Cloud Function
      // can use it instead of the default LLM_PROVIDER environment variable.
      await uploadBytes(storageRef, file, { customMetadata: { provider } });
    } catch (err) {
      setError(errorMessage(err));
      setState('error');
      return;
    }

    setState('analyzing');

    // Listen for a new report to appear in Firestore (written by the Cloud
    // Function). Completion is only ever declared from here.
    const reportQuery = query(
      collection(db, 'reports'),
      orderBy('reportDate', 'desc'),
      limit(1)
    );

    stopListening();
    unsubscribeRef.current = onSnapshot(
      reportQuery,
      (snapshot) => {
        if (snapshot.empty) return;
        const data = snapshot.docs[0].data() as { createdAt?: { toDate?: () => Date } };
        const createdAt = typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : null;
        if (createdAt && createdAt.getTime() > started) {
          stopListening();
          setState('complete');
        }
      },
      (err) => {
        stopListening();
        setError(errorMessage(err));
        setState('error');
      }
    );
  }, [provider, stopListening]);

  const reset = useCallback(() => {
    stopListening();
    setState('idle');
    setPreview(null);
    setError(null);
    setStartedAt(null);
    setElapsedSeconds(0);
  }, [stopListening]);

  return { state, preview, error, provider, setProvider, parseFile, uploadAndAnalyze, reset, elapsedSeconds };
}
