import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Region, RegionData, RiskDeal, StatData, TwentyQuestionsData, CompetitiveDisplacementData, DeltaIntelligenceData } from '@/lib/types';
import { useLatestReport } from '@/hooks/useFirestore';
import { countDealsByRegion } from '@/lib/injectDeals';
import { formatDate } from '@/lib/format';

function computeInFlightStats(risks: RiskDeal[]): { avgHealthScore: StatData; dealsAtRisk: StatData; velocity: StatData } {
  const withScore = risks.filter(r => typeof r.healthScore === 'number');
  const avgScore = withScore.length > 0
    ? Math.round(withScore.reduce((sum, r) => sum + (r.healthScore ?? 0), 0) / withScore.length)
    : null;

  const atRiskCount = risks.filter(r => r.level === 'HIGH' || r.level === 'MEDIUM').length;
  const atRiskPct = risks.length > 0 ? Math.round((atRiskCount / risks.length) * 100) : 0;

  // Compute avg days stalled across all deals
  const avgDaysStalled = risks.length > 0
    ? Math.round(risks.reduce((sum, r) => sum + (r.daysStalled || 0), 0) / risks.length)
    : null;

  return {
    avgHealthScore: {
      value: avgScore !== null ? `${avgScore}` : '—',
      change: avgScore !== null ? (avgScore >= 70 ? 'Healthy' : avgScore >= 40 ? 'Caution' : 'At Risk') : '—',
      dir: avgScore !== null ? (avgScore >= 70 ? 'up' : 'down') : 'flat',
      sub: 'avg deal health score',
    },
    dealsAtRisk: {
      value: risks.length > 0 ? `${atRiskPct}%` : '—',
      change: `${atRiskCount} deals`,
      dir: atRiskPct > 50 ? 'up' : 'flat',
      sub: 'HIGH or MEDIUM risk',
    },
    velocity: {
      value: avgDaysStalled !== null ? `${avgDaysStalled}d` : '—',
      change: avgDaysStalled !== null
        ? (avgDaysStalled <= 7 ? 'Healthy' : avgDaysStalled <= 21 ? 'Slowing' : 'Stalled')
        : '—',
      dir: avgDaysStalled !== null
        ? (avgDaysStalled <= 7 ? 'up' : 'down')
        : 'flat',
      sub: 'avg days since last activity',
    },
  };
}

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

  const baseData: RegionData = useMemo(() => {
    if (report?.transformed?.[region]) {
      return report.transformed[region];
    }
    return EMPTY_REGION_DATA;
  }, [region, report]);

  const data: RegionData = useMemo(() => {
    const computed = computeInFlightStats(baseData.risks ?? []);
    return {
      ...baseData,
      stats: {
        ...baseData.stats,
        avgHealthScore: computed.avgHealthScore,
        dealsAtRisk: computed.dealsAtRisk,
        velocity: computed.velocity,
      },
    };
  }, [baseData]);

  const allData: RegionData = useMemo(() => {
    if (report?.transformed?.all) {
      const regionalRisks = Object.entries(report.transformed)
        .filter(([key]) => key !== 'all')
        .flatMap(([key, regionData]) =>
          (regionData.risks || []).map((risk) => ({
            ...risk,
            region: risk.region || key,
          }))
        );

      const existingRegions = new Set((report.transformed.all.risks || []).map((risk) => risk.region).filter(Boolean));
      const regionalRegions = new Set(regionalRisks.map((risk) => risk.region).filter(Boolean));
      const allRisksAreComplete = regionalRegions.size === 0 || existingRegions.size >= regionalRegions.size;

      return {
        ...report.transformed.all,
        risks: allRisksAreComplete ? report.transformed.all.risks : regionalRisks,
      };
    }
    return EMPTY_REGION_DATA;
  }, [report]);

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

  // Per-region deal counts for RegionTabs — counted from the deals actually
  // loaded (per normalised key), so the badge matches what the tab shows.
  const regionCounts = useMemo<Record<string, number> | undefined>(() => {
    if (!isLive) return undefined;
    return countDealsByRegion(allData.risks ?? []);
  }, [isLive, allData]);

  const dealsError = isLive ? report?.dealsError : undefined;

  // Run metadata for the footer — read defensively, nothing is invented.
  const reportMeta = useMemo(() => {
    if (!isLive || !report) return undefined;
    const createdAt = report.createdAt;
    const createdIso = createdAt instanceof Date
      ? createdAt.toISOString()
      : typeof (createdAt as { toDate?: () => Date } | undefined)?.toDate === 'function'
        ? (createdAt as { toDate: () => Date }).toDate().toISOString()
        : undefined;
    const quality = report.dataQuality?.averageQualityScore;
    return {
      recordsAnalyzed: typeof report.totalRecordsAnalyzed === 'number' ? report.totalRecordsAnalyzed : undefined,
      provider: typeof report.analysisProvider === 'string' ? report.analysisProvider : undefined,
      model: typeof report.analysisModel === 'string' ? report.analysisModel : undefined,
      generatedAt: formatDate(report.reportDate || createdIso) || undefined,
      dataQualityScore: typeof quality === 'number' ? quality : undefined,
      sourceTruncated: report.pipelineMeta?.sourceTruncated,
      sourceRowLimit: report.pipelineMeta?.sourceRowLimit,
      rejectedCount: report.pipelineMeta?.rejectedCount,
    };
  }, [isLive, report]);

  return {
    region, data, allData, selectRegion, loading, isLive, hasLiveData, showingContent,
    executiveBriefing: displayBriefing, totalOpportunities, reportPeriod, regionCounts,
    reportDate, dealsError, reportMeta,
    twentyQuestions, competitiveDisplacement, deltaIntelligence,
  };
}
