/**
 * Project Prism - OpenAI LLM Provider
 * Implementation of OpenAI's GPT API for revenue intelligence analysis
 */

import OpenAI from "openai";
import { ILLMProvider, LLMAnalysisOutput, LLMProviderError, LLMRateLimitError } from "./provider.js";
import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";
import {
  isPortfolioCall,
  OPPORTUNITY_ANALYSIS_JSON_SCHEMA,
  parseStrictAnalysis,
} from "./analysisSchema.js";

/**
 * OpenAI LLM Provider implementation
 * Uses OpenAI's GPT models for structured analysis
 */
export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private config: LLMConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  /**
   * Initialize OpenAI provider with configuration
   */
  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  /**
   * Analyzes opportunities using OpenAI API
   * Implements rate limiting and error handling
   */
  async analyze(
    opportunities: OpportunityRecord[],
    prompt: string
  ): Promise<LLMAnalysisOutput[]> {
    const results: LLMAnalysisOutput[] = [];

    for (const opportunity of opportunities) {
      try {
        const startTime = Date.now();

        // Apply rate limiting (100 requests per minute = ~600ms per request)
        await this.enforceRateLimit();

        // Format opportunity data with all available fields
        const opportunityData = formatOpportunityForPrompt({
          opportunityId: opportunity.opportunityId,
          accountName: opportunity.accountName,
          opportunityName: opportunity.opportunityName,
          stage: opportunity.stage,
          amount: opportunity.amount,
          winLossStatus: opportunity.winLossStatus,
          notes: opportunity.notes,
          dealReviewNotes: opportunity.dealReviewNotes,
          region: opportunity.region,
          industry: opportunity.industry,
          closedDate: opportunity.closedDate,
          createdDate: opportunity.createdDate,
          updatedDate: opportunity.updatedDate,
          lastActivityDate: opportunity.lastActivityDate,
          salesRep: opportunity.salesRep,
          winLossReason: opportunity.winLossReason,
          nextStep: opportunity.nextStep,
          probability: opportunity.probability,
          forecastCategory: opportunity.forecastCategory,
          leadSource: opportunity.leadSource,
          dealType: opportunity.dealType,
          economicBuyer: opportunity.economicBuyer,
          productLine: opportunity.productLine,
        });

        // Inject data into prompt
        const fullPrompt = injectOpportunityData(prompt, opportunityData);

        // Portfolio-level calls (Phases 2-5) have their own output shapes and
        // are parsed by the caller from rawResponse; per-deal calls enforce
        // the shared schema so truncated or malformed JSON cannot slip through.
        const portfolioCall = isPortfolioCall(opportunity.opportunityId);

        // Call OpenAI API
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP || 0.9,
          frequency_penalty: this.config.frequencyPenalty || 0,
          presence_penalty: this.config.presencePenalty || 0,
          response_format: portfolioCall
            ? { type: "json_object" }
            : {
                type: "json_schema",
                json_schema: {
                  name: "opportunity_analysis",
                  strict: true,
                  schema: OPPORTUNITY_ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
                },
              },
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: fullPrompt,
            },
          ],
        });

        const processingTime = Date.now() - startTime;

        // Extract response text
        const responseText = response.choices[0].message.content || "";
        if (response.choices[0].finish_reason === "length") {
          throw new LLMProviderError(
            "OpenAI",
            `Response truncated at ${this.config.maxTokens} tokens for ${opportunity.opportunityId}`
          );
        }

        const analysis: Partial<OpportunityAnalysis> = portfolioCall
          ? { opportunityId: opportunity.opportunityId }
          : parseStrictAnalysis(
              JSON.parse(responseText),
              opportunity.opportunityId,
              "OpenAI"
            );

        results.push({
          analysis,
          rawResponse: responseText,
          processingTimeMs: processingTime,
          success: true,
          tokensUsed: {
            input: response.usage?.prompt_tokens || 0,
            output: response.usage?.completion_tokens || 0,
          },
        });

        this.requestCount++;
      } catch (error) {
        // Preserve typed provider errors (incl. validation failures) as-is
        if (error instanceof LLMProviderError) {
          throw error;
        }

        if (error instanceof OpenAI.RateLimitError) {
          throw new LLMRateLimitError("OpenAI", 60, error);
        }

        if (error instanceof OpenAI.APIError) {
          throw new LLMProviderError(
            "OpenAI",
            `API Error: ${error.message}`,
            error
          );
        }

        throw new LLMProviderError(
          "OpenAI",
          `Failed to analyze opportunity ${opportunity.opportunityId}: ${String(error)}`,
          error
        );
      }
    }

    return results;
  }

  /**
   * Validates connection to OpenAI API
   */
  async validateConnection(): Promise<void> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: "Return the word 'ok'.",
          },
        ],
      });

      if (!response.choices[0].message.content) {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      throw new LLMProviderError(
        "OpenAI",
        "Failed to validate connection",
        error
      );
    }
  }

  /**
   * Returns provider info
   */
  getProviderInfo() {
    return {
      name: "OpenAI GPT",
      model: this.config.model,
      version: "1.0.0",
    };
  }

  /**
   * Enforces rate limiting (100 requests per minute)
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minTimeBetweenRequests = 600; // 100 req/min = 600ms per request

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const delayMs = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    this.lastRequestTime = Date.now();
  }
}
