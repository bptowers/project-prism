/**
 * Project Prism - OpenAI LLM Provider
 * Implementation of OpenAI's GPT API for revenue intelligence analysis
 */

import OpenAI from "openai";
import { ILLMProvider, LLMAnalysisOutput, LLMProviderError, LLMRateLimitError } from "./provider.js";
import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData } from "./prompts.js";

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

        // Format opportunity data
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
        });

        // Inject data into prompt
        const fullPrompt = injectOpportunityData(prompt, opportunityData);

        // Call OpenAI API
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP || 0.9,
          frequency_penalty: this.config.frequencyPenalty || 0,
          presence_penalty: this.config.presencePenalty || 0,
          messages: [
            {
              role: "system",
              content:
                "You are an expert revenue intelligence analyst. Return valid JSON only.",
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

        // Parse JSON response
        const analysis = this.parseAnalysisResponse(
          responseText,
          opportunity.opportunityId
        );

        results.push({
          analysis,
          rawResponse: responseText,
          processingTimeMs: processingTime,
          tokensUsed: {
            input: response.usage?.prompt_tokens || 0,
            output: response.usage?.completion_tokens || 0,
          },
        });

        this.requestCount++;
      } catch (error) {
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
   * Parses OpenAI's JSON response into OpportunityAnalysis structure
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
        themes: {
          win: Array.isArray(parsed.themes?.win) ? parsed.themes.win : [],
          loss: Array.isArray(parsed.themes?.loss) ? parsed.themes.loss : [],
          neutral: Array.isArray(parsed.themes?.neutral)
            ? parsed.themes.neutral
            : [],
        },
        riskSignals: {
          level: parsed.riskSignals?.level || "none",
          signals: Array.isArray(parsed.riskSignals?.signals)
            ? parsed.riskSignals.signals
            : [],
          summary: parsed.riskSignals?.summary || "",
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
        },
        confidence: typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      };
    } catch (error) {
      console.error(
        `Failed to parse OpenAI response for ${opportunityId}:`,
        error
      );
      throw new LLMProviderError(
        "OpenAI",
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
