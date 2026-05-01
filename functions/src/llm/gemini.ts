/**
 * Project Prism - Google Gemini LLM Provider
 * Implementation of Google's Gemini API via Google AI Studio for revenue intelligence analysis
 */

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { ILLMProvider, LLMAnalysisOutput, LLMProviderError, LLMRateLimitError } from "./provider.js";
import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";

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

        // Get the generative model — model name read from LLM_MODEL env var
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

        // Parse JSON response
        let analysis: Partial<OpportunityAnalysis>;
        try {
          analysis = this.parseAnalysisResponse(
            responseText,
            opportunity.opportunityId
          );
        } catch (parseError) {
          const candidates = response.response.candidates || [];
          const finishReasons = candidates
            .map((candidate) => candidate.finishReason || "unknown")
            .join(",");
          const finishMessages = candidates
            .map((candidate) => candidate.finishMessage || "")
            .filter(Boolean)
            .join(" | ");
          console.error(
            `Failed to parse Gemini response for ${opportunity.opportunityId}: ${String(parseError)} ` +
            `responseLength=${responseText.length} finishReasons=${finishReasons || "none"} ` +
            `finishMessages=${finishMessages || "none"} ` +
            `usage=${JSON.stringify(response.response.usageMetadata || {})} ` +
            `preview=${JSON.stringify(responseText.slice(0, 500))}`
          );
          throw parseError;
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
   * Extracts the first complete JSON object from a string using balanced bracket counting.
   * Handles brackets inside strings correctly. Used as fallback when direct parse fails.
   */
  private extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  /**
   * Parses Gemini's JSON response into OpportunityAnalysis structure
   */
  private parseAnalysisResponse(
    responseText: string,
    opportunityId: string
  ): Partial<OpportunityAnalysis> {
    try {
      // Try direct parse first (clean path when responseMimeType: "application/json" is set)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        // Fallback: extract the first complete JSON object from the response text
        const extracted = this.extractFirstJsonObject(responseText);
        if (!extracted) throw new Error("No JSON found in response");
        parsed = JSON.parse(extracted);
      }

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
        `Failed to parse Gemini response for ${opportunityId}:`,
        error
      );
      throw new LLMProviderError(
        "Gemini",
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
