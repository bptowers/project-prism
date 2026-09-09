/**
 * getLLMConfig resolves provider, model and API key from the environment.
 * Security review 2026-09-09: a live Anthropic key was found in functions/.env
 * under the generic LLM_API_KEY name and deployed as a plain runtime env var.
 * Keys must come only from the provider-specific Secret Manager secrets.
 */
import { getLLMConfig } from "./config.js";

const ENV_KEYS = [
  "LLM_PROVIDER", "LLM_MODEL", "LLM_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY",
  "CLAUDE_MODEL", "GEMINI_MODEL", "OPENAI_MODEL", "LLM_MAX_TOKENS", "LLM_TEMPERATURE", "LLM_TOP_P",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

describe("getLLMConfig API key resolution", () => {
  it("uses the provider-specific secret", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gem-key";
    expect(getLLMConfig().apiKey).toBe("gem-key");
  });

  it("does NOT fall back to the generic LLM_API_KEY", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.LLM_API_KEY = "should-be-ignored";
    expect(() => getLLMConfig()).toThrow(/GEMINI_API_KEY/);
  });

  it("names the missing secret for the selected provider", () => {
    process.env.LLM_PROVIDER = "claude";
    expect(() => getLLMConfig()).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("getLLMConfig model selection", () => {
  it("uses provider defaults when nothing is configured", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "k";
    expect(getLLMConfig().model).toBe("gemini-2.5-flash");
  });

  it("honours a per-upload provider override and ignores the generic LLM_MODEL for it", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.LLM_MODEL = "gemini-2.5-flash";
    process.env.ANTHROPIC_API_KEY = "a";
    const cfg = getLLMConfig("claude");
    expect(cfg.provider).toBe("claude");
    expect(cfg.model).toBe("claude-sonnet-4-6");
  });

  it("defaults maxTokens to 16384 (the documented default)", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "k";
    expect(getLLMConfig().maxTokens).toBe(16384);
  });
});
