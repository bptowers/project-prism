import { useState, useCallback, useMemo } from 'react';
import type { Region, RegionData } from '@/lib/types';
import { regionDataMap } from '@/data/sampleData';
import { useLatestReport } from '@/hooks/useFirestore';

export function useRegion() {
  const [region, setRegion] = useState<Region>('all');
  const [forceSample, setForceSample] = useState(false);
  const { report, loading } = useLatestReport();

  const hasLiveData = useMemo(() => {
    return !!report?.transformed && Object.keys(report.transformed).length > 0;
  }, [report]);

  const isLive = hasLiveData && !forceSample;

  const data: RegionData = useMemo(() => {
    // If we have live Firestore data and user hasn't forced sample mode, use it
    if (!forceSample && report?.transformed?.[region]) {
      return report.transformed[region];
    }
    // Fall back to sample data
    return regionDataMap[region];
  }, [region, report, forceSample]);

  const selectRegion = useCallback((r: Region) => setRegion(r), []);

  const resetToSample = useCallback(() => setForceSample(true), []);
  const useLiveData = useCallback(() => setForceSample(false), []);

  return { region, data, selectRegion, loading, isLive, hasLiveData, forceSample, resetToSample, useLiveData };
}
