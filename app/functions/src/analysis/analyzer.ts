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
  LLMProviderError,
  LLMRateLimitError,
} from "../llm/provider.js";
import { COMPREHENSIVE_ANALYSIS_PROMPT } from "../llm/prompts.js";

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

      // Step 3: Process each batch
      const allResults: OpportunityAnalysis[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(
          `[${executionContext.executionId}] Processing batch ${i + 1}/${batches.length} (${batch.records.length} records)`
        );

        const batchResult = await this.processBatch(batch, executionContext);
        allResults.push(...batchResult.results);
        successCount += batchResult.successCount;
        failureCount += batchResult.failureCount;

        // Log batch errors
        if (batchResult.errors.length > 0) {
          console.warn(
            `[${executionContext.executionId}] Batch ${batch.batchId} errors:`,
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
   * Processes a single batch of records
   */
  private async processBatch(
    batch: ProcessingBatch,
    executionContext: ExecutionContext
  ): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    const batchResults: OpportunityAnalysis[] = [];
    const batchErrors: Array<{ recordId: string; error: string }> = [];

    for (const record of batch.records) {
      let success = false;
      let lastError: string | undefined;

      // Retry logic
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(
              `[${executionContext.executionId}] Retrying record ${record.opportunityId} (attempt ${attempt}/${this.maxRetries})`
            );
            await this.delay(this.retryDelayMs * attempt);
          }

          // Call LLM provider
          const analysisResults = await this.llmProvider.analyze(
            [record],
            COMPREHENSIVE_ANALYSIS_PROMPT
          );

          if (analysisResults.length > 0 && analysisResults[0].success) {
            const analysis = analysisResults[0].analysis;

            // Enrich with metadata
            const enriched = this.enrichAnalysis(analysis, record);
            batchResults.push(enriched);
            success = true;
            executionContext.recordsSuccessful++;
            break;
          } else {
            lastError = analysisResults[0]?.error || "Unknown error";
          }
        } catch (error) {
          if (error instanceof LLMRateLimitError) {
            // For rate limit errors, wait longer and retry
            const waitTime = error.retryAfterSeconds * 1000;
            console.warn(
              `[${executionContext.executionId}] Rate limited, waiting ${waitTime}ms`
            );
            await this.delay(waitTime);
          }

          lastError = String(error);

          if (attempt === this.maxRetries) {
            break;
          }
        }
      }

      if (!success) {
        batchErrors.push({
          recordId: record.opportunityId,
          error: lastError || "Unknown error",
        });
        executionContext.recordsFailed++;
      }

      executionContext.recordsProcessed++;
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
    return {
      opportunityId: analysis.opportunityId || record.opportunityId,
      accountName: record.accountName,
      opportunityName: record.opportunityName,
      region: record.region,
      stage: record.stage,
      winLossStatus: record.winLossStatus,
      analysisDate: new Date().toISOString(),
      themes: analysis.themes || { win: [], loss: [], neutral: [] },
      riskSignals: analysis.riskSignals || {
        level: "none",
        signals: [],
        summary: "",
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
