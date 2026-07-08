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
  LLMProviderFactory,
  LLMRateLimitError,
} from "../llm/provider.js";
import { COMPREHENSIVE_ANALYSIS_PROMPT } from "../llm/prompts.js";
import { computeDealMetrics } from "./dealMetrics.js";

/**
 * Represents a batch of opportunities to be processed
 */
interface ProcessingBatch {
  batchId: string;
  records: OpportunityRecord[];
  createdAt: Date;
}

/**
 * Analysis result for a batch
 */
interface BatchAnalysisResult {
  batchId: string;
  results: OpportunityAnalysis[];
  errors: Array<{
    recordId: string;
    error: string;
  }>;
  processingTimeMs: number;
  successCount: number;
  failureCount: number;
}

/**
 * Main analysis orchestrator
 * Handles the complete pipeline from raw records to analyzed results
 */
export class Analyzer {
  private llmProvider: ILLMProvider;
  private validator: DataValidator;
  private batchSize: number;
  private maxRetries: number;
  private retryDelayMs: number;

  /**
   * Initialize analyzer with LLM provider and configuration
   */
  constructor(
    llmProvider: ILLMProvider,
    batchSize: number = 25,
    maxRetries: number = 3,
    retryDelayMs: number = 1000,
    enablePiiScrubbing: boolean = true
  ) {
    this.llmProvider = llmProvider;
    this.validator = new DataValidator(enablePiiScrubbing);
    this.batchSize = batchSize;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  /**
   * Creates analyzer from configuration
   */
  static async create(
    config: LLMConfig,
    batchSize?: number,
    maxRetries?: number,
    retryDelayMs?: number
  ): Promise<Analyzer> {
    const provider = await LLMProviderFactory.create(config);
    return new Analyzer(provider, batchSize, maxRetries, retryDelayMs);
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

      // Step 2: Create processing batches
      const batches = this.createBatches(validRecords);
      console.log(
        `[${executionContext.executionId}] Created ${batches.length} processing batches`
      );

      // Step 3: Process all batches in parallel to stay within function timeout
      // Each batch has its own internal concurrency (5 at a time), so batches
      // run simultaneously rather than sequentially. This reduces wall-clock time
      // from ~22min (sequential) to ~6min (parallel), fitting within the 540s limit.
      batches.forEach((batch, i) => {
        console.log(
          `[${executionContext.executionId}] Processing batch ${i + 1}/${batches.length} (${batch.records.length} records)`
        );
      });

      const batchResults = await Promise.all(
        batches.map((batch) => this.processBatch(batch, executionContext))
      );

      const allResults: OpportunityAnalysis[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const batchResult of batchResults) {
        allResults.push(...batchResult.results);
        successCount += batchResult.successCount;
        failureCount += batchResult.failureCount;

        // Log batch errors
        if (batchResult.errors.length > 0) {
          console.warn(
            `[${executionContext.executionId}] Batch ${batchResult.batchId} errors:`,
            batchResult.errors
          );
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(
        `[${executionContext.executionId}] Analysis complete: ${successCount} successes, ${failureCount} failures (${totalTime}ms)`
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
          executionContext.recordsSuccessful++;
          executionContext.recordsProcessed++;
          return { result: enriched };
        } else {
          lastError = analysisResults[0]?.error || "Unknown error";
        }
      } catch (error) {
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
   * Processes a single batch of records with concurrency
   */
  private async processBatch(
    batch: ProcessingBatch,
    executionContext: ExecutionContext
  ): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    const batchResults: OpportunityAnalysis[] = [];
    const batchErrors: Array<{ recordId: string; error: string }> = [];

    // Process records concurrently (5 at a time to avoid rate limits)
    const concurrency = 5;
    for (let i = 0; i < batch.records.length; i += concurrency) {
      const chunk = batch.records.slice(i, i + concurrency);
      const results = await Promise.all(
        chunk.map((record) => this.processRecord(record, executionContext))
      );

      for (const res of results) {
        if (res.result) {
          batchResults.push(res.result);
        }
        if (res.error) {
          batchErrors.push(res.error);
        }
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      batchId: batch.batchId,
      results: batchResults,
      errors: batchErrors,
      processingTimeMs: processingTime,
      successCount: batchResults.length,
      failureCount: batchErrors.length,
    };
  }

  /**
   * Enriches LLM analysis with metadata
   */
  private enrichAnalysis(
    analysis: Partial<OpportunityAnalysis>,
    record: OpportunityRecord
  ): OpportunityAnalysis {
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
      dealHealthScore: analysis.dealHealthScore ?? 50,
      velocityAssessment: metrics.velocityAssessment,
      activityHealth: metrics.activityHealth,
      daysSinceLastActivity: metrics.daysSinceLastActivity ?? metrics.daysSinceLastModified,
      daysSinceLastModified: metrics.daysSinceLastModified,
      stakeholderCoverage: analysis.stakeholderCoverage || "unknown",
      competitorThreat: analysis.competitorThreat || "none",
      riskSignals: analysis.riskSignals || {
        level: "none",
        signals: [],
        summary: "",
      },
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
        score: 0.5,
        label: "neutral",
      },
      recommendedAction: analysis.recommendedAction || {
        priority: "P3",
        action: "Review deal status with rep",
        owner: "Manager",
        deadline: "This week",
      },
      confidence: analysis.confidence || 0.5,
      processingTimeMs: analysis.processingTimeMs || 0,
    };
  }

  /**
   * Creates processing batches from records
   */
  private createBatches(records: OpportunityRecord[]): ProcessingBatch[] {
    const batches: ProcessingBatch[] = [];
    const batchCount = Math.ceil(records.length / this.batchSize);

    for (let i = 0; i < batchCount; i++) {
      const start = i * this.batchSize;
      const end = Math.min(start + this.batchSize, records.length);

      batches.push({
        batchId: `batch_${i + 1}_${Date.now()}`,
        records: records.slice(start, end),
        createdAt: new Date(),
      });
    }

    return batches;
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
