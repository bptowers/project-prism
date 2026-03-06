export type Region = 'all' | 'na' | 'uk' | 'au' | 'nz';
export type RiskLevel = 'HIGH' | 'MEDIUM';
export type ThreatLevel = 'high' | 'medium' | 'low';
export type Priority = 'P1' | 'P2' | 'P3';

export interface StatData {
  value: string;
  change: string;
  dir: 'up' | 'down' | 'flat';
  sub: string;
}

export interface Stats {
  pipeline: StatData;
  winRate: StatData;
  atRisk: StatData;
  velocity: StatData;
  forecast: StatData;
  threats: StatData;
}

export interface FunnelStage {
  stage: string;
  count: number;
  revenue: string;
  color: string;
}

export interface ThemeItem {
  label: string;
  pct: number;
  revenue: string;
}

export interface RiskDeal {
  id: number;
  region: string;
  level: RiskLevel;
  value: string;
  confidence: number;
  summary: string;
  action: string;
  daysStalled: number;
}

export interface MarketSignal {
  dir: 'up' | 'down' | 'flat';
  text: string;
}

export interface Competitor {
  name: string;
  threat: ThreatLevel;
  wins: number;
  losses: number;
  pending: number;
  fud: string;
}

export interface Recommendation {
  priority: Priority;
  title: string;
  desc: string;
  impact: string;
}

export interface TrendData {
  weeks: string[];
  all: number[];
  na: number[];
  uk: number[];
  au: number[];
  nz: number[];
}

export interface RegionData {
  stats: Stats;
  sparklines: Record<string, number[]>;
  funnel: FunnelStage[];
  winThemes: ThemeItem[];
  lossThemes: ThemeItem[];
  risks: RiskDeal[];
  signals: MarketSignal[];
  competitors: Competitor[];
  recommendations: Recommendation[];
  trendData: TrendData;
}

export interface ReportDocument {
  id: string;
  reportDate: string;
  createdAt: Date;
  analysisProvider: string;
  totalRecordsAnalyzed: number;
  executiveBriefing?: string;
  transformed?: Record<string, RegionData>;
  [key: string]: unknown;
}
