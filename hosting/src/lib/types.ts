export type Region = 'all' | 'na' | 'uk' | 'au';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
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
  winRate?: StatData;         // deprecated — legacy; may still exist in older Firestore reports
  atRisk: StatData;
  velocity: StatData;
  forecast: StatData;
  threats?: StatData;         // deprecated — replaced by dealsAtRisk
  avgHealthScore?: StatData;  // average deal health score (0-100)
  dealsAtRisk?: StatData;     // % of deals rated HIGH or MEDIUM risk
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
  opportunityId?: string;
  accountName?: string;
  stage?: string;
  rep?: string;
  segment?: string;
  region: string;
  level: RiskLevel;
  value: string;
  pipelineValue?: number;
  healthScore?: number;
  confidence: number;
  summary: string;
  action: string;
  daysStalled: number;
  /** Which source field pipelineValue was derived from (backend contract; optional on older reports). */
  pipelineBasis?: 'mrr' | 'amount';
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

// Phase 3: Twenty Questions (CRO Intelligence)
// These interfaces mirror the exact shape the backend TWENTY_QUESTIONS_PROMPT
// emits (see functions/src/llm/prompts.ts return format). They were previously
// out of sync — the frontend expected an older schema (topReps, accelerating,
// inactiveDeals) the backend no longer produces, so every expanded question
// detail rendered empty. Keep these aligned with that prompt's return block.

// Q1 — Deals Gone Silent (silent7Days / silent14Days / silent30Days)
export interface TQSilentDeal {
  name: string;
  rep: string;
  region: string;
  mrr: string;
  stage: string;
  daysSinceActivity: number;
}

// Deal rows across Q2, Q5, Q9, Q10 — the backend calls each array "deals" but
// the per-question fields differ, so this is the union of those fields.
export interface TQDealRow {
  name: string;
  rep: string;
  region: string;
  mrr: string;
  stage?: string;
  // Q2 — Close Date Slippage
  currentCloseDate?: string;
  slippageSignal?: string;
  likelyCause?: string;
  // Q5 — Late-Stage Deals Without Economic Buyer
  daysInStage?: number;
  recommendedAction?: string;
  // Q9 — Stage-Stalled Deals
  benchmark?: string;
  overBy?: string;
  primaryBlocker?: string;
  // Q10 — Top 5 Deals Needing CRO Intervention
  healthScore?: number;
  urgencySignal?: string;
  croAction?: string;
  deadline?: string;
}

// Q3 (coverage) and Q8 (risk exposure) both return a "regions" array with
// different fields — union of both.
export interface TQRegionRow {
  region: string;
  // Q3 — Pipeline Coverage Below 3x
  activePipelineMrr?: string;
  coverageRatio?: number;
  gap?: string;
  fastestPath?: string;
  // Q8 — Forecast-Weighted Risk Exposure by Region
  totalActiveMrr?: string;
  highRiskMrr?: string;
  riskPercentage?: number;
  primaryRiskDriver?: string;
}

// Q4 — Reps with Highest At-Risk Concentration
export interface TQRepRow {
  name: string;
  region: string;
  totalDeals: number;
  highRiskDeals: number;
  highRiskMrr: string;
  primaryPattern: string;
}

// Q6 — Competitive Pressure Intensifying
export interface TQThreatRow {
  competitor: string;
  region: string;
  affectedDeals: number;
  mrrAtRisk: string;
  displacementPattern: string;
}

// Q7 — Probability vs Health Score Gap (optimismBias / sandbagging)
export interface TQGapDeal {
  name: string;
  rep: string;
  region: string;
  statedProbability: number;
  dealHealthScore: number;
  gap: number;
  interpretation: string;
}

export interface TQQuestion {
  label: string;
  answer: string;
  // Q1
  silent7Days?: TQSilentDeal[];
  silent14Days?: TQSilentDeal[];
  silent30Days?: TQSilentDeal[];
  // Q2, Q5, Q9, Q10
  deals?: TQDealRow[];
  // Q3, Q8
  regions?: TQRegionRow[];
  // Q4
  reps?: TQRepRow[];
  // Q6
  threats?: TQThreatRow[];
  // Q7
  optimismBias?: TQGapDeal[];
  sandbagging?: TQGapDeal[];
  // Q9 header stats
  bottleneckStage?: string;
  isSystemic?: boolean;
  totalMrrStuck?: string;
}

export interface TwentyQuestionsData {
  generatedAt?: string;
  question1?: TQQuestion;
  question2?: TQQuestion;
  question3?: TQQuestion;
  question4?: TQQuestion;
  question5?: TQQuestion;
  question6?: TQQuestion;
  question7?: TQQuestion;
  question8?: TQQuestion;
  question9?: TQQuestion;
  question10?: TQQuestion;
}

// Phase 4: Competitive Displacement
export interface WinMechanism {
  primarySwitchingTrigger: string;
  championProfile: string;
  decisiveProofPoint: string;
  primaryCompetitor: string;
  winRate?: string;
}

export interface LossMechanism {
  region: string;
  competitor: string;
  statedReason: string;
  realMechanism: string;
  counter: string;
}

export interface RegionalArbitrage {
  dealProfile: string;
  winningRegion: string;
  losingRegion: string;
  divergenceCause: string;
  transferAction: string;
}

export interface RewarmOpportunity {
  lossReason: string;
  dealCount: number;
  mrrOpportunity: string;
  changedContext: string;
  outreachNarrative: string;
}

export interface CompetitiveDisplacementData {
  winMechanisms?: Record<string, WinMechanism>;
  lossMechanisms?: LossMechanism[];
  regionalArbitrage?: RegionalArbitrage[];
  whyHaventTheyBought?: {
    silentLossPattern: string;
    urgencyGap: string;
    missingNarrative: string;
  };
  rewarmOpportunities?: RewarmOpportunity[];
}

// Phase 5: Delta Intelligence
export interface DeltaDeal {
  deal: string;
  rep: string;
  region: string;
  change: string;
  implication?: string;
  urgency?: string;
  interventionNeeded?: string;
  mrr?: string;
  competitor?: string;
  predicted?: boolean;
  surprise?: boolean;
  daysSilent?: number;
}

export interface EarlyWarning {
  signal: string;
  severity: 'critical' | 'important' | 'watch';
  affectedMrr: string;
  recommendedAction: string;
}

export interface DeltaIntelligenceData {
  analysisDate?: string;
  comparedTo?: string;
  daysBetween?: number;
  pipelineTrajectory?: {
    direction: 'improving' | 'stable' | 'declining';
    headline: string;
    pipelineMrrDelta: string;
    activeDealsChange: string;
    winRateChange: string;
    riskTrajectory: string;
  };
  significantDealChanges?: {
    improved: DeltaDeal[];
    deteriorated: DeltaDeal[];
    newPipeline?: { count: number; totalMrr: string; qualityAssessment: string };
    exited?: {
      closedWon: DeltaDeal[];
      closedLost: DeltaDeal[];
      goneDark: DeltaDeal[];
    };
  };
  competitiveMomentumShift?: {
    gaining: { competitor: string; evidence: string }[];
    losing: { competitor: string; evidence: string }[];
    newThreats: string[];
  };
  regionalTrajectory?: { region: string; direction: 'improving' | 'stable' | 'declining'; keyChange: string }[];
  forecastDrift?: {
    previousRealistic: string;
    currentRealistic: string;
    delta: string;
    driftDirection: 'improving' | 'stable' | 'declining';
    primaryCause: string;
    quarterEndProjection: string;
  };
  earlyWarnings?: EarlyWarning[];
}

/** Source-ingest facts written by the backend (optional on older reports). */
export interface PipelineMeta {
  sourceTruncated: boolean;
  sourceRowLimit: number;
  sourceRowCount: number;
  rejectedRecords: { opportunityId: string; reasons: string[] }[];
}

export interface ReportDocument {
  id: string;
  reportDate: string;
  /** Firestore Timestamp on the wire; the client reads it defensively. */
  createdAt: Date | { toDate: () => Date };
  analysisProvider: string;
  analysisModel?: string;
  totalRecordsAnalyzed: number;
  dataQuality?: { averageQualityScore?: number };
  pipelineMeta?: PipelineMeta;
  executiveBriefing?: string;
  twentyQuestions?: TwentyQuestionsData;
  competitiveDisplacement?: CompetitiveDisplacementData;
  deltaIntelligence?: DeltaIntelligenceData;
  transformed?: Record<string, RegionData>;
  /** Set client-side when the /reports/{date}/deals subcollection fetch failed. */
  dealsError?: string;
  [key: string]: unknown;
}
