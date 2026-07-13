/**
 * Project Prism - LLM Provider Interface and Factory
 * Defines the contract for LLM implementations and provides factory pattern instantiation
 */

import { LLMConfig, OpportunityAnalysis, OpportunityRecord } from "../types.js";
import { ClaudeProvider } from "./claude.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAIProvider } from "./openai.js";

/**
 * Token usage reported by a provider call.
 */
export interface LLMTokenUsage {
  input: number;
  output: number;
}

/**
 * Analysis result from an LLM provider
 */
export interface LLMAnalysisOutput {
  analysis: Partial<OpportunityAnalysis>;
  rawResponse: string;
  processingTimeMs: number;
  success: boolean;
  error?: string;
  tokensUsed?: LLMTokenUsage;
}

/**
 * Result of a free-form completion call (portfolio-level enrichment prompts).
 */
export interface LLMCompletionOutput {
  text: string;
  tokensUsed?: LLMTokenUsage;
}

/**
 * Abstract interface defining the contract for all LLM providers
 * Each provider implementation must conform to this interface
 */
export interface ILLMProvider {
  /**
   * Analyzes opportunity data and returns structured insights
   * @param opportunities Array of opportunity records to analyze
   * @param prompt The analysis prompt/template to use
   * @returns Promise containing analysis results
   */
  analyze(
    opportunities: OpportunityRecord[],
    prompt: string
  ): Promise<LLMAnalysisOutput[]>;

  /**
   * Runs a single free-form completion for portfolio-level enrichment prompts
   * (Phases 2–5), which have per-phase output shapes rather than the fixed
   * per-deal schema. Returns the raw text for the caller to extract JSON from.
   * @param userPrompt The fully-composed prompt (summary + grounded deal table)
   * @param opts Optional overrides (e.g. maxTokens)
   */
  complete(
    userPrompt: string,
    opts?: { maxTokens?: number }
  ): Promise<LLMCompletionOutput>;

  /**
   * Tests connectivity and API key validity
   * @returns Promise that resolves if provider is accessible
   */
  validateConnection(): Promise<void>;

  /**
   * Returns provider metadata
   */
  getProviderInfo(): {
    name: string;
    model: string;
    version: string;
  };
}

/**
 * Factory for creating LLM provider instances
 * Follows the Factory design pattern to abstract provider instantiation
 */
export class LLMProviderFactory {
  /**
   * Creates an LLM provider instance based on configuration
   * @param config LLM configuration specifying provider type and settings
   * @returns Promise resolving to configured LLM provider instance
   * @throws Error if provider type is unknown or configuration is invalid
   */
  static async create(config: LLMConfig): Promise<ILLMProvider> {
    LLMProviderFactory.validateConfig(config);

    switch (config.provider.toLowerCase()) {
      case "claude":
        return new ClaudeProvider(config);

      case "gemini":
        return new GeminiProvider(config);

      case "openai":
        return new OpenAIProvider(config);

      default:
        throw new Error(
          `Unknown LLM provider: ${config.provider}. Supported providers: claude, gemini, openai`
        );
    }
  }

  /**
   * Validates LLM configuration
   * @param config Configuration to validate
   * @throws Error if configuration is invalid
   */
  private static validateConfig(config: LLMConfig): void {
    if (!config.provider) {
      throw new Error("LLM provider must be specified");
    }

    if (!config.model) {
      throw new Error("LLM model must be specified");
    }

    if (!config.apiKey) {
      throw new Error("LLM API key must be provided");
    }

    if (config.temperature < 0 || config.temperature > 2) {
      throw new Error("Temperature must be between 0 and 2");
    }

    if (config.maxTokens < 100) {
      throw new Error("maxTokens must be at least 100");
    }

    if (config.topP !== undefined && (config.topP < 0 || config.topP > 1)) {
      throw new Error("topP must be between 0 and 1");
    }
  }

  /**
   * Gets list of supported providers
   */
  static getSupportedProviders(): string[] {
    return ["claude", "gemini", "openai"];
  }

  /**
   * Gets default config for a provider
   */
  static getDefaultConfig(provider: string): Partial<LLMConfig> {
    const configs: Record<string, Partial<LLMConfig>> = {
      claude: {
        model: "claude-sonnet-4-5-20250929",
        temperature: 0.3,
        maxTokens: 2000,
        topP: 0.9,
      },
      gemini: {
        model: "gemini-2.5-flash",
        temperature: 0.3,
        maxTokens: 8192,
      },
      openai: {
        model: "gpt-4o",
        temperature: 0.3,
        maxTokens: 2000,
        topP: 0.9,
      },
    };

    return (
      configs[provider.toLowerCase()] || {
        temperature: 0.3,
        maxTokens: 2000,
      }
    );
  }
}

/**
 * Error type for LLM provider errors
 */
export class LLMProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public originalError?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "LLMProviderError";
  }
}

/**
 * Error type for LLM rate limiting
 */
export class LLMRateLimitError extends LLMProviderError {
  constructor(
    provider: string,
    public retryAfterSeconds: number,
    originalError?: unknown
  ) {
    super(
      provider,
      `Rate limit exceeded. Retry after ${retryAfterSeconds}s`,
      originalError
    );
    this.name = "LLMRateLimitError";
  }
}

/**
 * Error type for LLM validation errors
 */
export class LLMValidationError extends LLMProviderError {
  constructor(provider: string, message: string) {
    super(provider, `Validation failed: ${message}`);
    this.name = "LLMValidationError";
  }
}

/**
 * Error for failures that retrying cannot fix (e.g. Gemini safety blocks).
 * The analyzer fails the record immediately instead of burning retries.
 */
export class LLMNonRetryableError extends LLMProviderError {
  constructor(provider: string, message: string, originalError?: unknown) {
    super(provider, message, originalError);
    this.name = "LLMNonRetryableError";
  }
}
