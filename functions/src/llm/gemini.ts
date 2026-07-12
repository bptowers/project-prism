/**
 * Project Prism - Google Gemini LLM Provider
 * Implementation of Google's Gemini API via Google AI Studio for revenue intelligence analysis
 */

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import {
  ILLMProvider,
  LLMAnalysisOutput,
  LLMNonRetryableError,
  LLMProviderError,
  LLMRateLimitError,
} from "./provider.js";
import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";
import { isPortfolioCall, parseStrictAnalysis } from "./analysisSchema.js";
import { extractAndParseJson } from "./jsonRepair.js";

/**
 * Gemini LLM Provider implementation
 * Uses Google AI Studio (API key auth) for structured analysis
 */
export class GeminiProvider implements ILLMProvider {
  private genAI: GoogleGenerativeAI;
  private config: LLMConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  private static readonly OPPORTUNITY_ANALYSIS_SCHEMA: ResponseSchema = {
    type: SchemaType.OBJECT,
    properties: {
      dealHealthScore: { type: SchemaType.NUMBER },
      velocityAssessment: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["accelerating", "on-track", "slowing", "stalled"],
      },
      activityHealth: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["active", "cooling", "dormant", "dark"],
      },
      stakeholderCoverage: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["multi-threaded", "single-threaded", "unknown"],
      },
      competitorThreat: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["none", "present", "active-displacement"],
      },
      riskSignals: {
        type: SchemaType.OBJECT,
        properties: {
          level: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["high", "medium", "low", "none"],
          },
          signals: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          summary: { type: SchemaType.STRING },
        },
        required: ["level", "signals", "summary"],
      },
      narrativeGap: {
        type: SchemaType.OBJECT,
        properties: {
          detected: { type: SchemaType.BOOLEAN },
          description: { type: SchemaType.STRING },
        },
        required: ["detected", "description"],
      },
      regionalIntelligence: {
        type: SchemaType.OBJECT,
        properties: {
          matchesRegionalPattern: { type: SchemaType.BOOLEAN },
          deviation: { type: SchemaType.STRING },
        },
        required: ["matchesRegionalPattern", "deviation"],
      },
      competitors: {
        type: SchemaType.OBJECT,
        properties: {
          mentioned: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          context: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["mentioned", "context"],
      },
      marketSignals: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
      },
      sentiment: {
        type: SchemaType.OBJECT,
        properties: {
          score: { type: SchemaType.NUMBER },
          label: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["positive", "neutral", "negative"],
          },
          basis: { type: SchemaType.STRING },
        },
        required: ["score", "label"],
      },
      recommendedAction: {
        type: SchemaType.OBJECT,
        properties: {
          priority: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["P1", "P2", "P3"],
          },
          action: { type: SchemaType.STRING },
          owner: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["AE", "Manager", "Executive", "CSM"],
          },
          deadline: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["Today", "48 hours", "This week"],
          },
        },
        required: ["priority", "action", "owner", "deadline"],
      },
      confidence: { type: SchemaType.NUMBER },
    },
    required: [
      "dealHealthScore",
      "velocityAssessment",
      "activityHealth",
      "stakeholderCoverage",
      "competitorThreat",
      "riskSignals",
      "narrativeGap",
      "regionalIntelligence",
      "competitors",
      "marketSignals",
      "sentiment",
      "recommendedAction",
      "confidence",
    ],
  };

  /**
   * Initialize Gemini provider with configuration
   */
  constructor(config: LLMConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Analyzes opportunities using Gemini API
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

        // Portfolio-level calls (Phases 2-5) use completely different output
        // schemas than individual deal analysis. Applying OPPORTUNITY_ANALYSIS_SCHEMA
        // to them causes Gemini to return an empty response. Detection is shared
        // across providers in analysisSchema.ts (and includes "portfolio-analysis",
        // which the old inline list here missed — Phase 2 was getting the wrong schema).
        const portfolioCall = isPortfolioCall(opportunity.opportunityId);

        // Get the generative model — model name read from LLM_MODEL env var
        const model = this.genAI.getGenerativeModel({
          model: this.config.model,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            maxOutputTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            topP: this.config.topP || 0.9,
            // Portfolio calls: JSON mode without schema (free-form structure).
            // Individual deal calls: JSON mode with strict schema.
            responseMimeType: "application/json",
            ...(portfolioCall ? {} : {
              responseSchema: GeminiProvider.OPPORTUNITY_ANALYSIS_SCHEMA,
            }),
          },
        });

        // Call Gemini API
        const response = await model.generateContent(fullPrompt);

        const processingTime = Date.now() - startTime;

        // Extract response text
        const responseText = response.response.text();

        // Empty response = Gemini safety block. Fail the record explicitly and
        // non-retryably (a retry hits the same block and wastes quota). A fake
        // "neutral" analysis is worse than a visible failure.
        if (responseText.length === 0) {
          const candidates = response.response.candidates || [];
          const finishReasons = candidates
            .map((candidate) => candidate.finishReason || "unknown")
            .join(",");
          throw new LLMNonRetryableError(
            "Gemini",
            `Empty response for ${opportunity.opportunityId} (likely safety block; finishReasons=${finishReasons || "none"})`
          );
        }

        // Diagnostics for the "No JSON object found" failure mode seen in
        // production on Phase 2/3 (Portfolio, Twenty Questions) — these are
        // the largest, most complex free-form outputs, and a non-empty
        // response with zero '{' characters is consistent with the model
        // exhausting maxOutputTokens on internal reasoning before it ever
        // writes the JSON body. The empty-response check above only fires on
        // a fully empty string; this covers the "some text, no braces" case
        // that check misses, so the next failure's logs show the real cause
        // (finishReason=MAX_TOKENS + candidatesTokenCount near the cap would
        // confirm truncation; anything else points elsewhere).
        if (portfolioCall && !responseText.includes("{")) {
          const candidates = response.response.candidates || [];
          const finishReasons = candidates.map((c) => c.finishReason || "unknown").join(",");
          const outputTokens = response.response.usageMetadata?.candidatesTokenCount ?? "unknown";
          console.warn(
            `[Gemini portfolio diagnostic] ${opportunity.opportunityId}: no '{' in response. ` +
            `finishReasons=${finishReasons} outputTokens=${outputTokens}/${this.config.maxTokens} ` +
            `responseLength=${responseText.length} snippet=${JSON.stringify(responseText.slice(0, 300))}`
          );
        }

        let analysis: Partial<OpportunityAnalysis>;
        if (portfolioCall) {
          // Caller extracts its own JSON from rawResponse
          analysis = { opportunityId: opportunity.opportunityId };
        } else {
          let parsed: unknown;
          try {
            parsed = JSON.parse(responseText);
          } catch {
            try {
              parsed = extractAndParseJson(responseText);
            } catch {
              throw new LLMProviderError(
                "Gemini",
                `No JSON found in response for ${opportunity.opportunityId}`
              );
            }
          }
          analysis = parseStrictAnalysis(parsed, opportunity.opportunityId, "Gemini");
        }

        results.push({
          analysis,
          rawResponse: responseText,
          processingTimeMs: processingTime,
          success: true,
          tokensUsed: {
            input: response.response.usageMetadata?.promptTokenCount || 0,
            output: response.response.usageMetadata?.candidatesTokenCount || 0,
          },
        });

        this.requestCount++;
      } catch (error) {
        // Preserve typed provider errors (incl. LLMNonRetryableError) as-is
        if (error instanceof LLMProviderError) {
          throw error;
        }

        // Check for rate limit errors
        if (error instanceof Error && error.message.includes("429")) {
          throw new LLMRateLimitError("Gemini", 60, error);
        }

        throw new LLMProviderError(
          "Gemini",
          `Failed to analyze opportunity ${opportunity.opportunityId}: ${String(error)}`,
          error
        );
      }
    }

    return results;
  }

  /**
   * Validates connection to Gemini API
   */
  async validateConnection(): Promise<void> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1,
        },
      });

      const response = await model.generateContent("Return the word 'ok'.");

      if (!response.response.text()) {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      throw new LLMProviderError(
        "Gemini",
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
      name: "Google Gemini",
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
