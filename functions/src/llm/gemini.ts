/**
 * Project Prism - Google Gemini LLM Provider
 * Implementation of Google's Gemini API via Vertex AI for revenue intelligence analysis
 */

import { VertexAI, Content } from "@google-cloud/vertexai";
import { ILLMProvider, LLMAnalysisOutput, LLMProviderError, LLMRateLimitError } from "./provider.js";
import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { formatOpportunityForPrompt, injectOpportunityData, SYSTEM_PROMPT } from "./prompts.js";

/**
 * Gemini LLM Provider implementation
 * Uses Google Cloud's Vertex AI for structured analysis
 */
export class GeminiProvider implements ILLMProvider {
  private vertex: VertexAI;
  private config: LLMConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  /**
   * Initialize Gemini provider with configuration
   */
  constructor(config: LLMConfig) {
    this.config = config;

    // Extract project ID from environment (Vertex AI uses Application Default Credentials)
    const projectId = process.env.GCP_PROJECT_ID || "default";

    this.vertex = new VertexAI({
      project: projectId,
      location: "us-central1",
    });
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

        // Prepare messages
        const generativeModel = this.vertex.getGenerativeModel({
          model: this.config.model,
        });

        // Build request
        const request = {
          contents: [
            {
              role: "user" as const,
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            } as Content,
          ],
          systemInstruction: {
            role: "system" as const,
            parts: [
              {
                text: SYSTEM_PROMPT,
              },
            ],
          },
          generationConfig: {
            maxOutputTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            topP: this.config.topP || 0.9,
          },
        };

        // Call Gemini API
        const response = await generativeModel.generateContent(request);

        const processingTime = Date.now() - startTime;

        // Extract response text
        const responseText =
          response.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
      const generativeModel = this.vertex.getGenerativeModel({
        model: this.config.model,
      });

      const response = await generativeModel.generateContent({
        contents: [
          {
            role: "user" as const,
            parts: [
              {
                text: "Return the word 'ok'.",
              },
            ],
          } as Content,
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1,
        },
      });

      if (!response.response.candidates?.[0]?.content?.parts?.[0]?.text) {
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
      name: "Google Gemini (Vertex AI)",
      model: this.config.model,
      version: "1.0.0",
    };
  }

  /**
   * Parses Gemini's JSON response into OpportunityAnalysis structure
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
