/**
 * LLM runtime configuration, resolved from environment variables.
 *
 * API keys come ONLY from the provider-specific secrets declared on each Cloud
 * Function (`secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]`).
 * There is deliberately no generic fallback: the 2026-09-09 review found a live
 * key deployed as a plain env var under a generic name, which is exactly what
 * a fallback invites.
 */
import { LLMConfig } from "../types.js";

type Provider = "claude" | "gemini" | "openai";

const SECRET_FOR_PROVIDER: Record<Provider, string> = {
  claude: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

const DEFAULT_MODEL: Record<Provider, string> = {
  claude: "claude-sonnet-4-6",
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
};

const MODEL_ENV_FOR_PROVIDER: Record<Provider, string> = {
  claude: "CLAUDE_MODEL",
  gemini: "GEMINI_MODEL",
  openai: "OPENAI_MODEL",
};

function asProvider(value: string | undefined): Provider {
  const p = (value || "claude").toLowerCase();
  if (p === "claude" || p === "gemini" || p === "openai") return p;
  throw new Error(`Unknown LLM provider "${value}". Expected claude | gemini | openai.`);
}

/**
 * @param providerOverride Per-upload provider selection (from Storage object
 *   metadata). When set, the generic LLM_MODEL is ignored because it belongs to
 *   the default provider; the override's own *_MODEL var or default is used.
 */
export function getLLMConfig(providerOverride?: string): LLMConfig {
  const provider = asProvider(providerOverride || process.env.LLM_PROVIDER);

  const secretName = SECRET_FOR_PROVIDER[provider];
  const apiKey = process.env[secretName] || "";
  if (!apiKey) {
    throw new Error(
      `API key not set for provider "${provider}": secret ${secretName} is missing. ` +
        "Add it in Firebase Secret Manager (firebase functions:secrets:set)."
    );
  }

  const providerModel = process.env[MODEL_ENV_FOR_PROVIDER[provider]] || DEFAULT_MODEL[provider];
  const model = providerOverride ? providerModel : process.env.LLM_MODEL || providerModel;

  // Enrichment-phase JSON (Twenty Questions especially) routinely exceeds
  // 2,000 output tokens, and Gemini 2.5's hidden thinking tokens count against
  // this cap, so the default is generous. Production .env sets 65536.
  const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || "16384", 10);

  return {
    provider,
    model,
    apiKey,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.3"),
    maxTokens,
    topP: parseFloat(process.env.LLM_TOP_P || "0.9"),
  };
}
