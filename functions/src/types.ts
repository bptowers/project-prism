/**
 * Project Prism - Core Type Definitions
 * Defines all data models, interfaces, and enums used throughout the pipeline
 */

/**
 * Represents a raw opportunity record from Salesforce CSV export
 */
export interface OpportunityRecord {
  opportunityId: string;
  accountName: string;
  opportunityName: string;
  stage: string;
  amount?: number;
  closedDate?: string;
  winLossStatus: "won" | "lost" | "active";
  winLossReason?: string;
  notes: string;
  region: string;
  industry?: string;
  dealReviewNotes?: string;
  createdDate?: string;
  updatedDate?: string;
  salesRep?: string;
  lastActivityDate?: string;
  nextStep?: string;
  probability?: number;
  forecastCategory?: string;
  leadSource?: string;
  dealType?: string;
  economicBuyer?: string;
  productLine?: string;
  expectedMRR?: number;
  [key: string]: unknown;
}

/**
 * Represents validation results for a single opportunity record
 */
export interface RecordValidation {
  recordId: string;
  isValid: boolean;
  qualityScore: number;
  errors: string[];
  warnings: string[];
  piiFlags: string[];
  hasScrubbedContent: boolean;
}

/**
 * Validation report for a batch of records
 */
export interface ValidationReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  averageQualityScore: number;
  totalPiiIssues: number;
  recordValidations: RecordValidation[];
  timestamp: Date;
}

/**
 * Theme with occurrence count and example notes
 */
export interface ThemeCount {
  theme: string;
  count: number;
  examples: string[];
  percentage: number;
}

/**
 * Deal flagged as at-risk with context
 */
export interface RiskDeal {
  opportunityId: string;
  accountName: string;
  opportunityName: string;
  riskLevel: "high" | "medium" | "low";
  signals: string[];
  summary: string;
  lastUpdated: string;
}

/**
 * Competitor activity aggregation
 */
export interface CompetitorActivity {
  competitor: string;
  mentionCount: number;
  contexts: string[];
  regions: string[];
  lossRate?: number;
}

/**
 * Analyzed result for a single opportunity
 */
export interface OpportunityAnalysis {
  opportunityId: string;
  accountName: string;
  opportunityName: string;
  region: string;
  stage: string;
  winLossStatus: "won" | "lost" | "active";
  analysisDate: string;
  themes: {
    win: string[];
    loss: string[];
    neutral?: string[];
  };
  riskSignals: {
    level: "high" | "medium" | "low" | "none";
    signals: string[];
    summary: string;
  };
  competitors: {
    mentioned: string[];
    context: string[];
  };
  marketSignals: string[];
  sentiment: {
    score: number;
    label: "positive" | "neutral" | "negative";
  };
  confidence: number;
  processingTimeMs: number;
}

/**
 * Regional aggregated analysis report
 */
export interface RegionReport {
  region: string;
  totalOpportunities: number;
  wins: number;
  losses: number;
  active: number;
  winRate: number;
  topWinThemes: ThemeCount[];
  topLossThemes: ThemeCount[];
  atRiskDeals: RiskDeal[];
  competitorActivity: CompetitorActivity[];
  marketSignals: string[];
  sentimentTrend: {
    average: number;
    label: "positive" | "neutral" | "negative";
  };
}

/**
 * Global summary across all regions
 */
export interface GlobalSummary {
  totalOpportunities: number;
  totalWins: number;
  totalLosses: number;
  totalActive: number;
  globalWinRate: number;
  topWinThemes: ThemeCount[];
  topLossThemes: ThemeCount[];
  topCompetitors: CompetitorActivity[];
  emergingMarketSignals: string[];
  globalSentiment: {
    average: number;
    label: "positive" | "neutral" | "negative";
  };
  highRiskCount: number;
  mediumRiskCount: number;
}

/**
 * Aggregated report combining all analyses
 */
export interface AggregatedReport {
  reportId: string;
  reportDate: string;
  period: string;
  processingStartTime: string;
  processingEndTime: string;
  totalRecordsAnalyzed: number;
  analysisProvider: string;
  analysisModel: string;
  regions: Record<string, RegionReport>;
  global: GlobalSummary;
  dataQuality: {
    averageQualityScore: number;
    totalPiiIssuesCaught: number;
  };
  executiveBriefing?: string;
  recommendations?: Array<{
    priority: "P1" | "P2" | "P3";
    title: string;
    description: string;
    revenueImpact: string;
  }>;
  forecastConfidence?: {
    percentage: number;
    assessment: string;
    upside: string;
    downside: string;
  };
  portfolioRisk?: {
    totalAtRisk: string;
    highRiskDeals: number;
    stalledRevenue: string;
    keyPattern: string;
  };
  funnelStages?: Array<{
    stage: string;
    count: number;
    revenue: number;
  }>;
  // Phase 3 enrichment: Pete's 20 Questions (CRO intelligence layer)
  twentyQuestions?: Record<string, unknown>;
  // Phase 4 enrichment: Competitive Displacement Intelligence
  competitiveDisplacement?: Record<string, unknown>;
  // Phase 5 enrichment: Delta Intelligence (temporal comparison)
  deltaIntelligence?: Record<string, unknown>;
}

/**
 * LLM analysis result with raw and parsed responses
 */
export interface LLMAnalysisResult {
  opportunityId: string;
  success: boolean;
  analysisData?: Partial<OpportunityAnalysis>;
  rawResponse?: string;
  error?: string;
  retryAttempt?: number;
  processingTimeMs: number;
}

/**
 * Configuration for LLM provider
 */
export interface LLMConfig {
  provider: "claude" | "gemini" | "openai";
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * CSV field mapping configuration
 */
export interface FieldMapping {
  opportunityId: string;
  accountName: string;
  opportunityName: string;
  stage: string;
  amount?: string;
  closedDate?: string;
  winLossStatus: string;
  winLossReason?: string;
  notes: string;
  industry?: string;
  dealReviewNotes?: string;
  createdDate?: string;
  updatedDate?: string;
  salesRep?: string;
  lastActivityDate?: string;
  nextStep?: string;
  probability?: string;
  forecastCategory?: string;
  leadSource?: string;
  dealType?: string;
  economicBuyer?: string;
  productLine?: string;
}

/**
 * Region mapping for geographic tagging
 */
export interface RegionMapping {
  [key: string]: string;
}

/**
 * Configuration for the entire pipeline
 */
export interface PipelineConfig {
  llm: LLMConfig;
  fieldMapping: FieldMapping;
  regionMapping: RegionMapping;
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  enablePiiScrubbing: boolean;
  confidenceThreshold: number;
}

/**
 * Analysis batch request
 */
export interface AnalysisBatch {
  batchId: string;
  records: OpportunityRecord[];
  batchSize: number;
  createdAt: Date;
}

/**
 * Execution context for tracking pipeline progress
 */
export interface ExecutionContext {
  executionId: string;
  startTime: Date;
  jobType: "csv-upload" | "scheduled-weekly" | "scheduled-bigquery" | "manual" | "api-request" | "bigquery-fetch";
  sourceFile?: string;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  status: "running" | "completed" | "failed" | "partial";
  errors: string[];
}
