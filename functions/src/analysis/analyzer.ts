/**
 * Project Prism - Analysis Orchestrator Module
 * Coordinates the analysis pipeline: validation -> LLM processing -> result aggregation
 */

import {
  ExecutionContext,
  LLMConfig,
  OpportunityAnalysis,
  OpportunityRecord,
} from "../types.js";
import { DataValidator } from "../pipeline/validator.js";
import {
  ILLMProvider,
  LLMNonRetryableError,
  LLMProviderFactory,
  LLMRateLimitError,
} from "../llm/provider.js";
import { COMPREHENSIVE_ANALYSIS_PROMPT } from "../llm/prompts.js";
import { computeDealMetrics } from "./dealMetrics.js";
import { mapWithConcurrency } from "../util/concurrency.js";

/**
 * Global cap on in-flight LLM analysis calls (env-overridable via
 * LLM_CONCURRENCY). Fallback of 25 chosen so a full ~260-deal run finishes
 * comfortably under onCSVUpload's 540s timeout even if the env var is unset:
 * a 258-deal run measured ~731s at concurrency 10, and wall-clock scales
 * roughly inversely with the cap, so 25 → ~290s. Prod sets LLM_CONCURRENCY=40.
 * The pre-refactor scheme ran ~55 concurrent with zero rate-limit failures,
 * so values in this range are known-safe against Gemini's limits.
 */
const DEFAULT_CONCURRENCY = 25;

/**
 * Main analysis orchestrator
 * Handles the complete pipeline from raw records to analyzed results
 */
export class Analyzer {
  private llmProvider: ILLMProvider;
  private validator: DataValidator;
  private concurrency: number;
  private maxRetries: number;
  private retryDelayMs: number;

  /**
   * Initialize analyzer with LLM provider and configuration
   */
  constructor(
    llmProvider: ILLMProvider,
    concurrency?: number,
    maxRetries: number = 3,
    retryDelayMs: number = 1000,
    enablePiiScrubbing: boolean = true
  ) {
    this.llmProvider = llmProvider;
    this.validator = new DataValidator(enablePiiScrubbing);
    this.concurrency =
      concurrency ?? parseInt(process.env.LLM_CONCURRENCY || String(DEFAULT_CONCURRENCY), 10);
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  /**
   * Creates analyzer from configuration
   */
  static async create(
    config: LLMConfig,
    concurrency?: number,
    maxRetries?: number,
    retryDelayMs?: number
  ): Promise<Analyzer> {
    const provider = await LLMProviderFactory.create(config);
    return new Analyzer(provider, concurrency, maxRetries, retryDelayMs);
  }

  /**
   * Analyzes a batch of opportunity records
   * Handles validation, batching, LLM processing, and error recovery
   */
  async analyze(
    records: OpportunityRecord[],
    executionContext: ExecutionContext
  ): Promise<OpportunityAnalysis[]> {
    const startTime = Date.now();

    try {
      console.log(
        `[${executionContext.executionId}] Starting analysis of ${records.length} records`
      );

      // Step 1: Validate records
      console.log(`[${executionContext.executionId}] Validating records...`);
      const validationReport = this.validator.validateBatch(records);

      console.log(
        `[${executionContext.executionId}] Validation complete: ${validationReport.validRecords}/${validationReport.totalRecords} valid (avg quality: ${validationReport.averageQualityScore})`
      );

      // Use only valid records
      const validRecords = records.filter((_, index) => {
        const validation = validationReport.recordValidations[index];
        return validation.isValid;
      });

      if (validRecords.length === 0) {
        console.warn(
          `[${executionContext.executionId}] No valid records to process`
        );
        return [];
      }

      // Step 2: Process every valid record through a single global concurrency
      // limiter (at most `this.concurrency` LLM calls in flight at once),
      // rather than the old batch-of-batches scheme where effective in-flight
      // was 5 × batchCount and only a racy per-provider rate limiter throttled it.
      console.log(
        `[${executionContext.executionId}] Analyzing ${validRecords.length} records with concurrency ${this.concurrency}`
      );

      const perRecord = await mapWithConcurrency(
        validRecords,
        this.concurrency,
        (record) => this.processRecord(record, executionContext)
      );

      const allResults: OpportunityAnalysis[] = [];
      const errors: Array<{ recordId: string; error: string }> = [];
      for (const res of perRecord) {
        if (res.result) allResults.push(res.result);
        if (res.error) errors.push(res.error);
      }

      if (errors.length > 0) {
        console.warn(
          `[${executionContext.executionId}] ${errors.length} record(s) failed analysis:`,
          errors
        );
      }

      const totalTime = Date.now() - startTime;
      console.log(
        `[${executionContext.executionId}] Analysis complete: ${allResults.length} successes, ${errors.length} failures (${totalTime}ms)`
      );

      return allResults;
    } catch (error) {
      executionContext.status = "failed";
      executionContext.errors.push(
        `Analysis failed: ${String(error)}`
      );
      console.error(
        `[${executionContext.executionId}] Analysis error:`,
        error
      );
      throw error;
    }
  }

  /**
   * Processes a single record with retry logic
   */
  private async processRecord(
    record: OpportunityRecord,
    executionContext: ExecutionContext
  ): Promise<{ result?: OpportunityAnalysis; error?: { recordId: string; error: string } }> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `[${executionContext.executionId}] Retrying record ${record.opportunityId} (attempt ${attempt}/${this.maxRetries})`
          );
          await this.delay(this.retryDelayMs * attempt);
        }

        const analysisResults = await this.llmProvider.analyze(
          [record],
          COMPREHENSIVE_ANALYSIS_PROMPT
        );

        if (analysisResults.length > 0 && analysisResults[0].success) {
          const enriched = this.enrichAnalysis(analysisResults[0].analysis, record);
          const used = analysisResults[0].tokensUsed;
          if (used) {
            executionContext.tokenUsage.input += used.input;
            executionContext.tokenUsage.output += used.output;
          }
          executionContext.recordsSuccessful++;
          executionContext.recordsProcessed++;
          return { result: enriched };
        } else {
          lastError = analysisResults[0]?.error || "Unknown error";
        }
      } catch (error) {
        if (error instanceof LLMNonRetryableError) {
          // e.g. Gemini safety block — retrying hits the same wall
          lastError = String(error);
          break;
        }
        if (error instanceof LLMRateLimitError) {
          const waitTime = error.retryAfterSeconds * 1000;
          console.warn(
            `[${executionContext.executionId}] Rate limited, waiting ${waitTime}ms`
          );
          await this.delay(waitTime);
        }
        lastError = String(error);
        if (attempt === this.maxRetries) break;
      }
    }

    executionContext.recordsFailed++;
    executionContext.recordsProcessed++;
    return { error: { recordId: record.opportunityId, error: lastError || "Unknown error" } };
  }

  /**
   * Enriches LLM analysis with metadata
   */
  private enrichAnalysis(
    analysis: Partial<OpportunityAnalysis>,
    record: OpportunityRecord
  ): OpportunityAnalysis {
    // Providers enforce a strict schema, so a successful result must carry the
    // required interpretive fields. Missing ones mean the analysis is unusable —
    // fail the record rather than shipping a defaulted score that looks real.
    if (
      analysis.dealHealthScore === undefined ||
      analysis.stakeholderCoverage === undefined ||
      analysis.competitorThreat === undefined ||
      analysis.riskSignals === undefined ||
      analysis.recommendedAction === undefined
    ) {
      throw new Error(
        `Incomplete analysis for ${record.opportunityId}: required fields missing from provider result`
      );
    }

    // Deterministic date-derived classifications are computed in code and
    // override whatever the LLM returned — reproducible run-to-run.
    const metrics = computeDealMetrics(record);
    return {
      opportunityId: analysis.opportunityId || record.opportunityId,
      accountName: record.accountName,
      opportunityName: record.opportunityName,
      region: record.region,
      stage: record.stage,
      amount: record.amount,
      expectedMRR: record.expectedMRR,
      salesRep: record.salesRep,
      probability: record.probability,
      dealType: record.dealType,
      winLossStatus: record.winLossStatus,
      analysisDate: new Date().toISOString(),
      dealHealthScore: analysis.dealHealthScore,
      velocityAssessment: metrics.velocityAssessment,
      activityHealth: metrics.activityHealth,
      daysSinceLastActivity: metrics.daysSinceLastActivity ?? metrics.daysSinceLastModified,
      daysSinceLastModified: metrics.daysSinceLastModified,
      stakeholderCoverage: analysis.stakeholderCoverage,
      competitorThreat: analysis.competitorThreat,
      riskSignals: analysis.riskSignals,
      recommendedAction: analysis.recommendedAction,
      // Cosmetic/narrative fields may default without masquerading as analysis
      narrativeGap: analysis.narrativeGap || {
        detected: false,
        description: "Narrative aligns with deal signals.",
      },
      regionalIntelligence: analysis.regionalIntelligence || {
        matchesRegionalPattern: true,
        deviation: "None detected.",
      },
      competitors: analysis.competitors || {
        mentioned: [],
        context: [],
      },
      marketSignals: analysis.marketSignals || [],
      sentiment: analysis.sentiment || {
        score: 0,
        label: "neutral",
      },
      confidence: analysis.confidence ?? 0.5,
      processingTimeMs: analysis.processingTimeMs || 0,
    };
  }

  /**
   * Utility to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets provider info
   */
  getProviderInfo() {
    return this.llmProvider.getProviderInfo();
  }
}
