/**
 * Project Prism - Shared Structured-Output Schema for Per-Deal Analysis
 *
 * One JSON Schema drives all three providers (Claude forced tool-use,
 * OpenAI json_schema response format, Gemini responseSchema is derived
 * separately in gemini.ts) and one strict parser replaces the per-provider
 * "default on missing field" logic. A failed or incomplete analysis must
 * surface as a failure — a defaulted dealHealthScore of 50 is fake analysis
 * indistinguishable from real analysis.
 */

import { OpportunityAnalysis } from "../types.js";
import { LLMValidationError } from "./provider.js";

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio-call detection
// The enrichment phases (Phases 2–5) reuse ILLMProvider.analyze() with a dummy
// record whose opportunityId identifies the call. Those calls have completely
// different output shapes, so providers must NOT force the per-deal schema on
// them. IDs must match the dummy records built in analysis/aggregator.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const PORTFOLIO_CALL_IDS = new Set([
  "portfolio-analysis",
  "twenty-questions",
  "competitive-displacement",
  "delta-intelligence",
  "executive-briefing", // legacy id, kept defensively
]);

export function isPortfolioCall(opportunityId: string): boolean {
  return PORTFOLIO_CALL_IDS.has(opportunityId);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema (plain object) — used as Claude tool input_schema and OpenAI
// json_schema. All properties required + additionalProperties:false so it is
// valid for OpenAI strict mode.
// ─────────────────────────────────────────────────────────────────────────────

const VELOCITY_ENUM = ["accelerating", "on-track", "slowing", "stalled"] as const;
const ACTIVITY_ENUM = ["active", "cooling", "dormant", "dark"] as const;
const STAKEHOLDER_ENUM = ["multi-threaded", "single-threaded", "unknown"] as const;
const COMPETITOR_THREAT_ENUM = ["none", "present", "active-displacement"] as const;
const RISK_LEVEL_ENUM = ["high", "medium", "low", "none"] as const;
const SENTIMENT_ENUM = ["positive", "neutral", "negative"] as const;
const PRIORITY_ENUM = ["P1", "P2", "P3"] as const;
const OWNER_ENUM = ["AE", "Manager", "Executive", "CSM"] as const;
const DEADLINE_ENUM = ["Today", "48 hours", "This week"] as const;

export const OPPORTUNITY_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    dealHealthScore: { type: "number", description: "0-100 objective deal health score" },
    velocityAssessment: { type: "string", enum: [...VELOCITY_ENUM], description: "Echo the COMPUTED Velocity value provided in the data" },
    activityHealth: { type: "string", enum: [...ACTIVITY_ENUM], description: "Echo the COMPUTED Activity Health value provided in the data" },
    stakeholderCoverage: { type: "string", enum: [...STAKEHOLDER_ENUM] },
    competitorThreat: { type: "string", enum: [...COMPETITOR_THREAT_ENUM] },
    riskSignals: {
      type: "object",
      additionalProperties: false,
      properties: {
        level: { type: "string", enum: [...RISK_LEVEL_ENUM] },
        signals: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
      },
      required: ["level", "signals", "summary"],
    },
    narrativeGap: {
      type: "object",
      additionalProperties: false,
      properties: {
        detected: { type: "boolean" },
        description: { type: "string" },
      },
      required: ["detected", "description"],
    },
    regionalIntelligence: {
      type: "object",
      additionalProperties: false,
      properties: {
        matchesRegionalPattern: { type: "boolean" },
        deviation: { type: "string" },
      },
      required: ["matchesRegionalPattern", "deviation"],
    },
    competitors: {
      type: "object",
      additionalProperties: false,
      properties: {
        mentioned: { type: "array", items: { type: "string" } },
        context: { type: "array", items: { type: "string" } },
      },
      required: ["mentioned", "context"],
    },
    marketSignals: { type: "array", items: { type: "string" } },
    sentiment: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        label: { type: "string", enum: [...SENTIMENT_ENUM] },
        basis: { type: "string" },
      },
      required: ["score", "label", "basis"],
    },
    recommendedAction: {
      type: "object",
      additionalProperties: false,
      properties: {
        priority: { type: "string", enum: [...PRIORITY_ENUM] },
        action: { type: "string" },
        owner: { type: "string", enum: [...OWNER_ENUM] },
        deadline: { type: "string", enum: [...DEADLINE_ENUM] },
      },
      required: ["priority", "action", "owner", "deadline"],
    },
    confidence: { type: "number" },
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
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Strict parsing — validate, clamp, and reject rather than default
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  problems: string[]
): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  problems.push(`${field}: expected one of [${allowed.join(", ")}], got ${JSON.stringify(value)}`);
  return allowed[0];
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Converts a parsed LLM response object into a validated Partial<OpportunityAnalysis>.
 * Throws LLMValidationError listing every problem when required classification
 * fields are missing or malformed — the caller records the deal as a failed
 * analysis instead of shipping a defaulted one.
 */
export function parseStrictAnalysis(
  raw: unknown,
  opportunityId: string,
  provider: string
): Partial<OpportunityAnalysis> {
  if (!raw || typeof raw !== "object") {
    throw new LLMValidationError(provider, `analysis for ${opportunityId} is not an object`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = raw as any;
  const problems: string[] = [];

  if (typeof p.dealHealthScore !== "number" || Number.isNaN(p.dealHealthScore)) {
    problems.push(`dealHealthScore: expected number, got ${JSON.stringify(p.dealHealthScore)}`);
  }
  const velocityAssessment = oneOf(p.velocityAssessment, VELOCITY_ENUM, "velocityAssessment", problems);
  const activityHealth = oneOf(p.activityHealth, ACTIVITY_ENUM, "activityHealth", problems);
  const stakeholderCoverage = oneOf(p.stakeholderCoverage, STAKEHOLDER_ENUM, "stakeholderCoverage", problems);
  const competitorThreat = oneOf(p.competitorThreat, COMPETITOR_THREAT_ENUM, "competitorThreat", problems);
  const riskLevel = oneOf(p.riskSignals?.level, RISK_LEVEL_ENUM, "riskSignals.level", problems);
  if (typeof p.riskSignals?.summary !== "string") {
    problems.push("riskSignals.summary: expected string");
  }
  const priority = oneOf(p.recommendedAction?.priority, PRIORITY_ENUM, "recommendedAction.priority", problems);
  const owner = oneOf(p.recommendedAction?.owner, OWNER_ENUM, "recommendedAction.owner", problems);
  const deadline = oneOf(p.recommendedAction?.deadline, DEADLINE_ENUM, "recommendedAction.deadline", problems);
  if (typeof p.recommendedAction?.action !== "string" || !p.recommendedAction.action.trim()) {
    problems.push("recommendedAction.action: expected non-empty string");
  }
  const sentimentLabel = oneOf(p.sentiment?.label, SENTIMENT_ENUM, "sentiment.label", problems);

  if (problems.length > 0) {
    throw new LLMValidationError(
      provider,
      `analysis for ${opportunityId} failed validation: ${problems.join("; ")}`
    );
  }

  return {
    opportunityId,
    dealHealthScore: clamp(p.dealHealthScore, 0, 100),
    velocityAssessment,
    activityHealth,
    stakeholderCoverage,
    competitorThreat,
    riskSignals: {
      level: riskLevel,
      signals: strArray(p.riskSignals?.signals),
      summary: p.riskSignals.summary,
    },
    narrativeGap: {
      detected: p.narrativeGap?.detected === true,
      description: typeof p.narrativeGap?.description === "string"
        ? p.narrativeGap.description
        : "Narrative aligns with deal signals.",
    },
    regionalIntelligence: {
      matchesRegionalPattern: p.regionalIntelligence?.matchesRegionalPattern !== false,
      deviation: typeof p.regionalIntelligence?.deviation === "string"
        ? p.regionalIntelligence.deviation
        : "None detected.",
    },
    competitors: {
      mentioned: strArray(p.competitors?.mentioned),
      context: strArray(p.competitors?.context),
    },
    marketSignals: strArray(p.marketSignals),
    sentiment: {
      score: typeof p.sentiment?.score === "number" ? clamp(p.sentiment.score, -1, 1) : 0,
      label: sentimentLabel,
      basis: typeof p.sentiment?.basis === "string" ? p.sentiment.basis : "",
    },
    recommendedAction: {
      priority,
      action: p.recommendedAction.action,
      owner,
      deadline,
    },
    confidence: typeof p.confidence === "number" ? clamp(p.confidence, 0, 1) : 0.5,
  };
}
