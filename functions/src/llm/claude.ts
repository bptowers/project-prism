/**
 * Project Prism - Claude LLM Provider
 * Implementation of Anthropic's Claude API for revenue intelligence analysis
 */

import Anthropic from "@anthropic-ai/sdk";
import { ILLMProvider, LLMAnalysisOutput, LLMProviderError, LLMRateLimitError } from "./provider.js";
import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";
import {
  isPortfolioCall,
  OPPORTUNITY_ANALYSIS_JSON_SCHEMA,
  parseStrictAnalysis,
} from "./analysisSchema.js";

/**
 * Claude LLM Provider implementation
 * Uses Anthropic's Claude API for structured analysis
 */
export class ClaudeProvider implements ILLMProvider {
  private client: Anthropic;
  private config: LLMConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  /**
   * Initialize Claude provider with configuration
   */
  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  /**
   * Analyzes opportunities using Claude API
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
        // are parsed by the caller from rawResponse — no forced schema.
        const portfolioCall = isPortfolioCall(opportunity.opportunityId);

        // Call Claude API. Per-deal calls force a tool call whose input schema
        // mirrors OpportunityAnalysis — no markdown fences, no truncated JSON,
        // schema-invalid output is rejected by the API rather than parsed leniently.
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          // cache_control: the ~8k-token system prompt (regional intelligence +
          // stage reference) is identical across every call in a run — caching
          // it cuts input cost on that portion by ~90% across a 500-deal run.
          system: [
            {
              type: "text" as const,
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" as const },
            },
          ],
          ...(portfolioCall
            ? {}
            : {
                tools: [
                  {
                    name: "record_analysis",
                    description:
                      "Record the structured revenue-intelligence analysis for this opportunity.",
                    input_schema: OPPORTUNITY_ANALYSIS_JSON_SCHEMA as unknown as Anthropic.Tool["input_schema"],
                  },
                ],
                tool_choice: { type: "tool" as const, name: "record_analysis" },
              }),
          messages: [
            {
              role: "user",
              content: fullPrompt,
            },
          ],
        });

        const processingTime = Date.now() - startTime;

        let analysis: Partial<OpportunityAnalysis>;
        let rawResponse: string;
        if (portfolioCall) {
          const textBlock = response.content.find((b) => b.type === "text");
          rawResponse = textBlock && textBlock.type === "text" ? textBlock.text : "";
          // Caller extracts its own JSON from rawResponse
          analysis = { opportunityId: opportunity.opportunityId };
        } else {
          const toolBlock = response.content.find((b) => b.type === "tool_use");
          if (!toolBlock || toolBlock.type !== "tool_use") {
            throw new LLMProviderError(
              "Claude",
              `No tool_use block in response for ${opportunity.opportunityId} (stop_reason: ${response.stop_reason})`
            );
          }
          rawResponse = JSON.stringify(toolBlock.input);
          analysis = parseStrictAnalysis(
            toolBlock.input,
            opportunity.opportunityId,
            "Claude"
          );
        }

        results.push({
          analysis,
          rawResponse,
          processingTimeMs: processingTime,
          success: true,
          tokensUsed: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
          },
        });

        this.requestCount++;
      } catch (error) {
        // Preserve typed provider errors (incl. validation failures) as-is
        if (error instanceof LLMProviderError) {
          throw error;
        }

        if (error instanceof Anthropic.RateLimitError) {
          throw new LLMRateLimitError("Claude", 60, error);
        }

        if (error instanceof Anthropic.APIError) {
          throw new LLMProviderError(
            "Claude",
            `API Error: ${error.message}`,
            error
          );
        }

        throw new LLMProviderError(
          "Claude",
          `Failed to analyze opportunity ${opportunity.opportunityId}: ${String(error)}`,
          error
        );
      }
    }

    return results;
  }

  /**
   * Validates connection to Claude API
   */
  async validateConnection(): Promise<void> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: "Return the word 'ok'.",
          },
        ],
      });

      if (response.content[0].type !== "text") {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      throw new LLMProviderError(
        "Claude",
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
      name: "Anthropic Claude",
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
