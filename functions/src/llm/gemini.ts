/**
 * Project Prism - Google Gemini LLM Provider
 * Implementation of Google's Gemini API via Google AI Studio for revenue intelligence analysis
 */

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import {
  ILLMProvider,
  LLMAnalysisOutput,
  LLMCompletionOutput,
  LLMNonRetryableError,
  LLMProviderError,
  LLMRateLimitError,
} from "./provider.js";
import { LLMConfig, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";
import { parseStrictAnalysis } from "./analysisSchema.js";
import { extractAndParseJson, extractJsonObject } from "./jsonRepair.js";

/**
 * Gemini LLM Provider implementation
 * Uses Google AI Studio (API key auth) for structured analysis
 */
export class GeminiProvider implements ILLMProvider {
  private genAI: GoogleGenerativeAI;
  private config: LLMConfig;

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

        // Per-deal calls use JSON mode with the strict OpportunityAnalysis
        // schema. Portfolio-level prompts (Phases 2–5) go through complete().
        const model = this.genAI.getGenerativeModel({
          model: this.config.model,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            maxOutputTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            topP: this.config.topP || 0.9,
            responseMimeType: "application/json",
            responseSchema: GeminiProvider.OPPORTUNITY_ANALYSIS_SCHEMA,
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
        const analysis = parseStrictAnalysis(parsed, opportunity.opportunityId, "Gemini");

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
   * Runs a free-form portfolio-level completion (enrichment Phases 2–5).
   *
   * gemini-2.5-flash spends "thinking" tokens from the SAME maxOutputTokens
   * budget as the visible response, and this SDK version's types don't expose
   * thinkingConfig or report thinking-token usage. In production, Phase 2/3
   * (the largest prompts) hit finishReason=MAX_TOKENS after only ~1,300 visible
   * tokens — ~30K+ consumed by invisible reasoning. Bounding thinkingBudget
   * guarantees room for the JSON body. The field isn't in this SDK's TS types
   * but the underlying API accepts it — cast around the gap rather than upgrade.
   */
  async complete(
    userPrompt: string,
    opts?: { maxTokens?: number }
  ): Promise<LLMCompletionOutput> {
    try {
      const maxTokens = opts?.maxTokens ?? this.config.maxTokens;
      const model = this.genAI.getGenerativeModel({
        model: this.config.model,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: this.config.temperature,
          topP: this.config.topP || 0.9,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 4096 },
        } as unknown as Record<string, never>,
      });

      const response = await model.generateContent(userPrompt);
      const text = response.response.text();

      // Diagnostic for the "no complete JSON object" failure mode: a non-empty
      // response with no balanced top-level object usually means the model ran
      // out of output budget mid-JSON. finishReason=MAX_TOKENS + outputTokens
      // near the cap confirms truncation; anything else points elsewhere.
      if (extractJsonObject(text) === null) {
        const candidates = response.response.candidates || [];
        const finishReasons = candidates.map((c) => c.finishReason || "unknown").join(",");
        const outputTokens = response.response.usageMetadata?.candidatesTokenCount ?? "unknown";
        console.warn(
          `[Gemini portfolio diagnostic] no complete JSON object in response. ` +
          `finishReasons=${finishReasons} outputTokens=${outputTokens}/${maxTokens} ` +
          `responseLength=${text.length} snippet=${JSON.stringify(text.slice(0, 300))}`
        );
      }

      return {
        text,
        tokensUsed: {
          input: response.response.usageMetadata?.promptTokenCount || 0,
          output: response.response.usageMetadata?.candidatesTokenCount || 0,
        },
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      if (error instanceof Error && error.message.includes("429")) {
        throw new LLMRateLimitError("Gemini", 60, error);
      }
      throw new LLMProviderError("Gemini", `Completion failed: ${String(error)}`, error);
    }
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
}
