/**
 * Project Prism - Report Transformer
 * Converts backend AggregatedReport into frontend RegionData shape
 */

import { AggregatedReport, RegionReport } from "../types.js";

interface StatData {
  value: string;
  change: string;
  dir: "up" | "down" | "flat";
  sub: string;
}

interface Stats {
  pipeline: StatData;
  winRate: StatData;
  atRisk: StatData;
  velocity: StatData;
  forecast: StatData;
  threats: StatData;
}

interface FunnelStage {
  stage: string;
  count: number;
  revenue: string;
  color: string;
}

interface ThemeItem {
  label: string;
  pct: number;
  revenue: string;
}

interface FrontendRiskDeal {
  id: number;
  opportunityId?: string;
  accountName?: string;
  stage?: string;
  rep?: string;
  segment?: string;
  region: string;
  level: "HIGH" | "MEDIUM" | "LOW";
  value: string;
  pipelineValue: number;
  healthScore: number;
  confidence: number;
  summary: string;
  action: string;
  daysStalled: number;
}

interface MarketSignal {
  dir: "up" | "down" | "flat";
  text: string;
}

interface Competitor {
  name: string;
  threat: "high" | "medium" | "low";
  wins: number;
  losses: number;
  pending: number;
  fud: string;
}

interface Recommendation {
  priority: "P1" | "P2" | "P3";
  title: string;
  desc: string;
  impact: string;
}

interface TrendData {
  weeks: string[];
  all: number[];
  na: number[];
  uk: number[];
  au: number[];
}

interface RegionData {
  stats: Stats;
  sparklines: Record<string, number[]>;
  funnel: FunnelStage[];
  winThemes: ThemeItem[];
  lossThemes: ThemeItem[];
  risks: FrontendRiskDeal[];
  signals: MarketSignal[];
  competitors: Competitor[];
  recommendations: Recommendation[];
  trendData: TrendData;
}

const FUNNEL_COLORS = [
  "var(--prism-blue)",
  "var(--accent)",
  "var(--prism-green)",
  "var(--prism-amber)",
  "var(--warning)",
  "var(--success)",
];

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

/**
 * Transforms an AggregatedReport into frontend-consumable RegionData
 */
export class ReportTransformer {
  static transform(
    report: AggregatedReport
  ): Record<string, RegionData> {
    const result: Record<string, RegionData> = {};

    // Transform "all" (global view)
    result["all"] = this.transformGlobal(report);

    // Transform each region
    for (const [regionKey, regionReport] of Object.entries(report.regions)) {
      const normalizedKey = this.normalizeRegionKey(regionKey);
      result[normalizedKey] = this.transformRegion(regionReport, report);
    }

    return result;
  }

  private static transformGlobal(report: AggregatedReport): RegionData {
    const g = report.global;

    // Calculate total pipeline value from funnel stages
    const totalPipeline = report.funnelStages
      ? report.funnelStages.reduce((sum, s) => sum + s.revenue, 0)
      : 0;

    const stats: Stats = {
      pipeline: {
        value: formatCurrency(totalPipeline),
        change: "—",
        dir: "flat",
        sub: "Total weighted pipeline",
      },
      winRate: {
        value: `${Math.round(g.globalWinRate * 100)}%`,
        change: "—",
        dir: "flat",
        sub: "Blended win rate",
      },
      atRisk: {
        value: `${g.highRiskCount + g.mediumRiskCount}`,
        change: `${g.highRiskCount} high`,
        dir: g.highRiskCount > 0 ? "down" : "flat",
        sub: `${g.highRiskCount + g.mediumRiskCount} deals flagged`,
      },
      velocity: {
        value: "—",
        change: "—",
        dir: "flat",
        sub: "Avg. close cycle",
      },
      forecast: {
        value: report.forecastConfidence
          ? `${report.forecastConfidence.percentage}%`
          : "—",
        change: "—",
        dir: "flat",
        sub: "AI confidence score",
      },
      threats: {
        value: `${g.topCompetitors.length}`,
        change: "—",
        dir: "flat",
        sub: "Active competitors",
      },
    };

    // Funnel stages
    const funnel: FunnelStage[] = (report.funnelStages || []).map((s, i) => ({
      stage: s.stage,
      count: s.count,
      revenue: formatCurrency(s.revenue),
      color: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    }));

    // Win/loss themes
    const winThemes: ThemeItem[] = g.topWinThemes.map((t) => ({
      label: t.theme,
      pct: t.percentage,
      revenue: `${t.count} deals`,
    }));

    const lossThemes: ThemeItem[] = g.topLossThemes.map((t) => ({
      label: t.theme,
      pct: t.percentage,
      revenue: `${t.count} deals`,
    }));

    // Deals to plot on the Risk Radar — prefer the full active pipeline so
    // healthy deals are visible; fall back to atRiskDeals for legacy reports
    // that pre-date the allActiveDeals field.
    const risks: FrontendRiskDeal[] = [];
    let riskId = 1;
    for (const regionReport of Object.values(report.regions)) {
      const sourceDeals = regionReport.allActiveDeals?.length
        ? regionReport.allActiveDeals
        : regionReport.atRiskDeals;
      for (const deal of sourceDeals) {
        risks.push({
          id: riskId++,
          opportunityId: deal.opportunityId,
          accountName: deal.accountName,
          stage: deal.stage,
          rep: deal.salesRep || "Unassigned",
          segment: deal.segment || "Unknown",
          region: regionReport.region,
          level: deal.riskLevel.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
          value: deal.opportunityName || deal.opportunityId || "—",
          pipelineValue: deal.amount || 0,
          healthScore: deal.dealHealthScore,
          confidence: deal.dealHealthScore ? Math.max(0, Math.min(100, 100 - deal.dealHealthScore)) : 80,
          summary: deal.summary,
          action: deal.recommendedAction || (deal.signals.length > 0 ? deal.signals[0] : "Review deal"),
          daysStalled: 0,
        });
      }
    }

    // Market signals
    const signals: MarketSignal[] = g.emergingMarketSignals.map((s) => ({
      dir: "up" as const,
      text: s,
    }));

    // Competitors
    const competitors: Competitor[] = g.topCompetitors.map((c) => ({
      name: c.competitor,
      threat: c.mentionCount >= 5 ? "high" : c.mentionCount >= 2 ? "medium" : "low",
      wins: 0,
      losses: c.mentionCount,
      pending: 0,
      fud: c.contexts.length > 0 ? c.contexts[0] : "",
    }));

    // Recommendations
    const recommendations: Recommendation[] = (report.recommendations || []).map((r) => ({
      priority: r.priority,
      title: r.title,
      desc: r.description,
      impact: r.revenueImpact,
    }));

    // Placeholder trend data
    const trendData: TrendData = {
      weeks: [report.period || new Date().toISOString().split("T")[0]],
      all: [g.globalWinRate * 100],
      na: [0],
      uk: [0],
      au: [0],


    };

    // Placeholder sparklines
    const sparklines: Record<string, number[]> = {
      pipeline: [totalPipeline],
      winRate: [g.globalWinRate * 100],
      atRisk: [g.highRiskCount + g.mediumRiskCount],
      velocity: [0],
      forecast: [report.forecastConfidence?.percentage || 0],
      threats: [g.topCompetitors.length],
    };

    return {
      stats,
      sparklines,
      funnel,
      winThemes,
      lossThemes,
      risks,
      signals,
      competitors,
      recommendations,
      trendData,
    };
  }

  private static transformRegion(
    region: RegionReport,
    report: AggregatedReport
  ): RegionData {
    const stats: Stats = {
      pipeline: {
        value: `${region.totalOpportunities} opps`,
        change: "—",
        dir: "flat",
        sub: `${region.wins}W / ${region.losses}L / ${region.active}A`,
      },
      winRate: {
        value: `${Math.round(region.winRate * 100)}%`,
        change: "—",
        dir: "flat",
        sub: `${region.wins} wins of ${region.wins + region.losses}`,
      },
      atRisk: {
        value: `${region.atRiskDeals.length}`,
        change: "—",
        dir: region.atRiskDeals.length > 0 ? "down" : "flat",
        sub: `${region.atRiskDeals.filter((d) => d.riskLevel === "high").length} high risk`,
      },
      velocity: { value: "—", change: "—", dir: "flat", sub: "Avg. close cycle" },
      forecast: {
        value: report.forecastConfidence
          ? `${report.forecastConfidence.percentage}%`
          : "—",
        change: "—",
        dir: "flat",
        sub: "AI confidence",
      },
      threats: {
        value: `${region.competitorActivity.length}`,
        change: "—",
        dir: "flat",
        sub: "Competitors detected",
      },
    };

    const funnel: FunnelStage[] = (region.stageDistribution || []).map((s, i) => ({
      stage: s.stage,
      count: s.count,
      revenue: formatCurrency(s.revenue),
      color: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    }));

    const winThemes: ThemeItem[] = region.topWinThemes.map((t) => ({
      label: t.theme,
      pct: t.percentage,
      revenue: `${t.count} deals`,
    }));

    const lossThemes: ThemeItem[] = region.topLossThemes.map((t) => ({
      label: t.theme,
      pct: t.percentage,
      revenue: `${t.count} deals`,
    }));

    const sourceDeals = region.allActiveDeals?.length ? region.allActiveDeals : region.atRiskDeals;
    const risks: FrontendRiskDeal[] = sourceDeals.map((d, i) => ({
      id: i + 1,
      opportunityId: d.opportunityId,
      accountName: d.accountName,
      stage: d.stage,
      rep: d.salesRep || "Unassigned",
      segment: d.segment || "Unknown",
      region: region.region,
      level: d.riskLevel.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
      value: d.opportunityName || d.opportunityId || "—",
      pipelineValue: d.amount || 0,
      healthScore: d.dealHealthScore,
      confidence: d.dealHealthScore ? Math.max(0, Math.min(100, 100 - d.dealHealthScore)) : 80,
      summary: d.summary,
      action: d.recommendedAction || (d.signals.length > 0 ? d.signals[0] : "Review deal"),
      daysStalled: 0,
    }));

    const signals: MarketSignal[] = region.marketSignals.map((s) => ({
      dir: "up" as const,
      text: s,
    }));

    const competitors: Competitor[] = region.competitorActivity.map((c) => ({
      name: c.competitor,
      threat: c.mentionCount >= 5 ? "high" : c.mentionCount >= 2 ? "medium" : "low",
      wins: 0,
      losses: c.mentionCount,
      pending: 0,
      fud: c.contexts.length > 0 ? c.contexts[0] : "",
    }));

    const recommendations: Recommendation[] = (report.recommendations || []).map((r) => ({
      priority: r.priority,
      title: r.title,
      desc: r.description,
      impact: r.revenueImpact,
    }));

    const trendData: TrendData = {
      weeks: [report.period || ""],
      all: [region.winRate * 100],
      na: [0],
      uk: [0],
      au: [0],


    };

    const sparklines: Record<string, number[]> = {
      pipeline: [region.totalOpportunities],
      winRate: [region.winRate * 100],
      atRisk: [region.atRiskDeals.length],
      velocity: [0],
      forecast: [0],
      threats: [region.competitorActivity.length],
    };

    return {
      stats,
      sparklines,
      funnel,
      winThemes,
      lossThemes,
      risks,
      signals,
      competitors,
      recommendations,
      trendData,
    };
  }

  private static normalizeRegionKey(key: string): string {
    const lower = key.toLowerCase().trim();
    // North America
    if (lower === "na" || lower === "us" || lower.includes("north america") || lower.includes("namer")) return "na";
    // United Kingdom (includes EMEA/EU — Simpro UK is the only EMEA region)
    if (lower === "uk" || lower === "gb" || lower.includes("united kingdom") || lower.includes("britain") || lower.includes("emea") || lower === "eu") return "uk";
    // AU / NZ combined (Simpro ANZ is a single region)
    if (lower === "au" || lower === "aus" || lower.includes("australia") ||
        lower === "nz" || lower.includes("new zealand") ||
        lower === "anz" || lower.includes("apac")) return "au";
    return lower;
  }
}
