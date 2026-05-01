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
export interface TQDeal {
  name: string;
  rep: string;
  region: string;
  mrr: string;
  reason?: string;
  stage?: string;
  daysInStage?: number;
  overBy?: string;
  implication?: string;
  forecastedMrr?: string;
  healthScore?: number;
  primaryReason?: string;
  mostLikelyOutcome?: string;
  primaryBlocker?: string;
}

export interface TQRep {
  name: string;
  region: string;
  reason: string;
}

export interface TQSegment {
  segment: string;
  evidence: string;
}

export interface TQQuestion {
  label: string;
  answer: string;
  deals?: TQDeal[];
  totalMrrAtRisk?: string;
  reportedPipeline?: string;
  ghostStrippedPipeline?: string;
  delta?: string;
  inactiveDeals?: string[];
  topReps?: TQRep[];
  bottomReps?: TQRep[];
  accelerating?: TQSegment[];
  decelerating?: TQSegment[];
  bottleneckStage?: string;
  isSystemic?: boolean;
  dealsStuck?: number;
  mrrStuck?: string;
  details?: TQDeal[];
  reportedForecast?: string;
  realisticForecast?: string;
  forecastFictionDelta?: string;
  atRiskDeals?: TQDeal[];
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

export interface ReportDocument {
  id: string;
  reportDate: string;
  createdAt: Date;
  analysisProvider: string;
  totalRecordsAnalyzed: number;
  executiveBriefing?: string;
  twentyQuestions?: TwentyQuestionsData;
  competitiveDisplacement?: CompetitiveDisplacementData;
  deltaIntelligence?: DeltaIntelligenceData;
  transformed?: Record<string, RegionData>;
  [key: string]: unknown;
}
