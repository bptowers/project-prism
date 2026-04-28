/**
 * Project Prism - Claude LLM Provider
 * Implementation of Anthropic's Claude API for revenue intelligence analysis
 */

import Anthropic from "@anthropic-ai/sdk";
import { ILLMProvider, LLMAnalysisOutput, LLMProviderError, LLMRateLimitError } from "./provider.js";
import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";

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

        // Call Claude API
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: fullPrompt,
            },
          ],
        });

        const processingTime = Date.now() - startTime;

        // Extract response text
        const responseText =
          response.content[0].type === "text" ? response.content[0].text : "";

        // Parse JSON response
        const analysis = this.parseAnalysisResponse(
          responseText,
          opportunity.opportunityId
        );

        results.push({
          analysis,
          rawResponse: responseText,
          processingTimeMs: processingTime,
          success: true,
          tokensUsed: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
          },
        });

        this.requestCount++;
      } catch (error) {
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
   * Parses Claude's JSON response into OpportunityAnalysis structure
   */
  private parseAnalysisResponse(
    responseText: string,
    opportunityId: string
  ): Partial<OpportunityAnalysis> {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        opportunityId,
        dealHealthScore: typeof parsed.dealHealthScore === "number" ? Math.max(0, Math.min(100, parsed.dealHealthScore)) : 50,
        velocityAssessment: parsed.velocityAssessment || "slowing",
        activityHealth: parsed.activityHealth || "cooling",
        stakeholderCoverage: parsed.stakeholderCoverage || "unknown",
        competitorThreat: parsed.competitorThreat || "none",
        riskSignals: {
          level: parsed.riskSignals?.level || "none",
          signals: Array.isArray(parsed.riskSignals?.signals)
            ? parsed.riskSignals.signals
            : [],
          summary: parsed.riskSignals?.summary || "",
        },
        narrativeGap: {
          detected: parsed.narrativeGap?.detected === true,
          description: parsed.narrativeGap?.description || "Narrative aligns with deal signals.",
        },
        regionalIntelligence: {
          matchesRegionalPattern: parsed.regionalIntelligence?.matchesRegionalPattern !== false,
          deviation: parsed.regionalIntelligence?.deviation || "None detected.",
        },
        competitors: {
          mentioned: Array.isArray(parsed.competitors?.mentioned)
            ? parsed.competitors.mentioned
            : [],
          context: Array.isArray(parsed.competitors?.context)
            ? parsed.competitors.context
            : [],
        },
        marketSignals: Array.isArray(parsed.marketSignals)
          ? parsed.marketSignals
          : [],
        sentiment: {
          score: typeof parsed.sentiment?.score === "number"
            ? Math.max(-1, Math.min(1, parsed.sentiment.score))
            : 0,
          label: parsed.sentiment?.label || "neutral",
          basis: parsed.sentiment?.basis || "",
        },
        recommendedAction: {
          priority: parsed.recommendedAction?.priority || "P3",
          action: parsed.recommendedAction?.action || "Review deal status with rep",
          owner: parsed.recommendedAction?.owner || "Manager",
          deadline: parsed.recommendedAction?.deadline || "This week",
        },
        confidence: typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      };
    } catch (error) {
      console.error(
        `Failed to parse Claude response for ${opportunityId}:`,
        error
      );
      throw new LLMProviderError(
        "Claude",
        `Failed to parse response: ${String(error)}`
      );
    }
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
