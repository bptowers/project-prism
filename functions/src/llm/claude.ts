/**
 * Project Prism - Claude LLM Provider
 * Implementation of Anthropic's Claude API for revenue intelligence analysis
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  ILLMProvider,
  LLMAnalysisOutput,
  LLMCompletionOutput,
  LLMProviderError,
  LLMRateLimitError,
} from "./provider.js";
import { LLMConfig, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";
import {
  OPPORTUNITY_ANALYSIS_JSON_SCHEMA,
  parseStrictAnalysis,
} from "./analysisSchema.js";

// System prompt sent as a cache_control block — the ~8k-token regional
// intelligence + stage reference is identical across every call in a run,
// so caching it cuts input cost on that portion by ~90%.
const CACHED_SYSTEM = [
  {
    type: "text" as const,
    text: SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" as const },
  },
];

/**
 * Claude LLM Provider implementation
 * Uses Anthropic's Claude API for structured analysis
 */
export class ClaudeProvider implements ILLMProvider {
  private client: Anthropic;
  private config: LLMConfig;

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

        // Per-deal calls force a tool call whose input schema mirrors
        // OpportunityAnalysis — no markdown fences, no truncated JSON, and
        // schema-invalid output is rejected by the API rather than parsed
        // leniently. Portfolio-level prompts go through complete() instead.
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: CACHED_SYSTEM,
          tools: [
            {
              name: "record_analysis",
              description:
                "Record the structured revenue-intelligence analysis for this opportunity.",
              input_schema: OPPORTUNITY_ANALYSIS_JSON_SCHEMA as unknown as Anthropic.Tool["input_schema"],
            },
          ],
          tool_choice: { type: "tool" as const, name: "record_analysis" },
          messages: [
            {
              role: "user",
              content: fullPrompt,
            },
          ],
        });

        const processingTime = Date.now() - startTime;

        const toolBlock = response.content.find((b) => b.type === "tool_use");
        if (!toolBlock || toolBlock.type !== "tool_use") {
          throw new LLMProviderError(
            "Claude",
            `No tool_use block in response for ${opportunity.opportunityId} (stop_reason: ${response.stop_reason})`
          );
        }
        const rawResponse = JSON.stringify(toolBlock.input);
        const analysis = parseStrictAnalysis(
          toolBlock.input,
          opportunity.opportunityId,
          "Claude"
        );

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
   * Runs a free-form portfolio-level completion (enrichment Phases 2–5).
   * No forced schema — the caller extracts JSON from the returned text.
   */
  async complete(
    userPrompt: string,
    opts?: { maxTokens?: number }
  ): Promise<LLMCompletionOutput> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: opts?.maxTokens ?? this.config.maxTokens,
        temperature: this.config.temperature,
        system: CACHED_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

      return {
        text,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new LLMRateLimitError("Claude", 60, error);
      }
      throw new LLMProviderError("Claude", `Completion failed: ${String(error)}`, error);
    }
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
}
