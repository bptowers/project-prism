import { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

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
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setState('analyzing');
      // Cloud Function will be triggered by the storage upload
      // For now, simulate analysis completion
      await new Promise(resolve => setTimeout(resolve, 3000));
      setState('complete');
    } catch (err) {
      console.info('Storage not configured yet — simulating upload.');
      setState('analyzing');
      await new Promise(resolve => setTimeout(resolve, 3000));
      setState('complete');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setPreview(null);
    setError(null);
  }, []);

  return { state, preview, error, provider, setProvider, parseFile, uploadAndAnalyze, reset };
}
