import { useState, useCallback, useMemo } from 'react';
import type { Region, RegionData } from '@/lib/types';
import { regionDataMap } from '@/data/sampleData';
import { useLatestReport } from '@/hooks/useFirestore';

export function useRegion() {
  const [region, setRegion] = useState<Region>('all');
  const [forceSample, setForceSample] = useState(false);
  const [sampleHidden, setSampleHidden] = useState(false);
  const { report, loading } = useLatestReport();

  const hasLiveData = useMemo(() => {
    return !!report?.transformed && Object.keys(report.transformed).length > 0;
  }, [report]);

  const isLive = hasLiveData && !forceSample;

  // Dashboard is showing real content (live or sample)
  const showingContent = isLive || !sampleHidden;

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
  const clearSampleData = useCallback(() => setSampleHidden(true), []);
  const restoreSampleData = useCallback(() => setSampleHidden(false), []);

  const executiveBriefing = isLive ? (report?.executiveBriefing as string | undefined) : undefined;
  const totalOpportunities = isLive ? (report?.totalRecordsAnalyzed as number | undefined) : undefined;
  const reportPeriod = isLive ? (report?.period as string | undefined) : undefined;

  // Per-region opportunity counts for RegionTabs — derived from transformed report
  const regionCounts = useMemo<Record<string, number> | undefined>(() => {
    if (!isLive || !report?.transformed) return undefined;
    const counts: Record<string, number> = {};
    for (const [key, regionData] of Object.entries(report.transformed as Record<string, { stats: { pipeline: { value: string } } }>)) {
      if (key === 'all') continue; // skip global aggregate
      const val = regionData?.stats?.pipeline?.value ?? '';
      const match = val.match(/^(\d+)/);
      if (match) counts[key] = parseInt(match[1], 10);
    }
    return counts;
  }, [isLive, report]);

  return {
    region, data, selectRegion, loading, isLive, hasLiveData,
    forceSample, resetToSample, useLiveData,
    sampleHidden, clearSampleData, restoreSampleData, showingContent,
    executiveBriefing, totalOpportunities, reportPeriod, regionCounts,
  };
}
