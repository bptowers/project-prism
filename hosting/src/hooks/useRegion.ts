import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Region, RegionData, TwentyQuestionsData, CompetitiveDisplacementData, DeltaIntelligenceData } from '@/lib/types';
import { useLatestReport } from '@/hooks/useFirestore';

const EMPTY_STAT = { value: '—', change: '—', dir: 'flat' as const, sub: '' };

const EMPTY_REGION_DATA: RegionData = {
  stats: {
    pipeline: EMPTY_STAT,
    winRate: EMPTY_STAT,
    atRisk: EMPTY_STAT,
    velocity: EMPTY_STAT,
    forecast: EMPTY_STAT,
    threats: EMPTY_STAT,
  },
  sparklines: {},
  funnel: [],
  winThemes: [],
  lossThemes: [],
  risks: [],
  signals: [],
  competitors: [],
  recommendations: [],
  trendData: { weeks: [], all: [], na: [], uk: [], au: [] },
};

export function useRegion() {
  const [region, setRegion] = useState<Region>('all');
  const { report, loading } = useLatestReport();

  const hasLiveData = useMemo(() => {
    return !!report?.transformed && Object.keys(report.transformed).length > 0;
  }, [report]);

  const isLive = hasLiveData;
  const showingContent = isLive;

  const data: RegionData = useMemo(() => {
    if (report?.transformed?.[region]) {
      return report.transformed[region];
    }
    return EMPTY_REGION_DATA;
  }, [region, report]);

  const selectRegion = useCallback((r: Region) => setRegion(r), []);

  const executiveBriefing = isLive ? (report?.executiveBriefing as string | undefined) : undefined;
  const totalOpportunities = isLive ? (report?.totalRecordsAnalyzed as number | undefined) : undefined;
  const reportPeriod = isLive ? (report?.period as string | undefined) : undefined;
  const reportDate = isLive ? (report?.reportDate as string | undefined) : undefined;

  const twentyQuestions = isLive ? (report?.twentyQuestions as TwentyQuestionsData | undefined) : undefined;
  const competitiveDisplacement = isLive ? (report?.competitiveDisplacement as CompetitiveDisplacementData | undefined) : undefined;
  const deltaIntelligence = isLive ? (report?.deltaIntelligence as DeltaIntelligenceData | undefined) : undefined;

  // Persist the last known briefing so the dashboard doesn't flash empty
  // during the gap between Phase 1 write (no briefing) and Phase 2 enrichment.
  const [lastKnownBriefing, setLastKnownBriefing] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (executiveBriefing) {
      setLastKnownBriefing(executiveBriefing);
    }
  }, [executiveBriefing]);

  const displayBriefing = executiveBriefing ?? (isLive ? lastKnownBriefing : undefined);

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
    region, data, selectRegion, loading, isLive, hasLiveData, showingContent,
    executiveBriefing: displayBriefing, totalOpportunities, reportPeriod, regionCounts,
    reportDate,
    twentyQuestions, competitiveDisplacement, deltaIntelligence,
  };
}
