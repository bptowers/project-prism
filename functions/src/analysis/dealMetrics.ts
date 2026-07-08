/**
 * Project Prism - Deterministic Deal Metrics
 *
 * activityHealth, velocityAssessment, and stall detection are pure
 * date/threshold arithmetic. Computing them here (instead of asking the LLM
 * to derive them) makes classifications reproducible run-to-run, removes the
 * "missing date defaulted to dark" failure mode, and shrinks the per-deal
 * prompt. The thresholds mirror Simpro's 14-day cycle benchmarks previously
 * spelled out in COMPREHENSIVE_ANALYSIS_PROMPT.
 */

import { OpportunityAnalysis, OpportunityRecord } from "../types.js";

export type ActivityHealth = OpportunityAnalysis["activityHealth"];
export type VelocityAssessment = OpportunityAnalysis["velocityAssessment"];

export interface DealMetrics {
  /** Whole days since lastActivityDate; null when the field is absent/unparseable */
  daysSinceLastActivity: number | null;
  /** Whole days since updatedDate (Last Modified) — proxy for stage age, no stage-entry date exists in the source data */
  daysSinceLastModified: number | null;
  /** Whole days since createdDate */
  daysSinceCreated: number | null;
  activityHealth: ActivityHealth;
  velocityAssessment: VelocityAssessment;
  isStalled: boolean;
  hasNextStep: boolean;
}

/**
 * Whole days between an ISO-ish date string and `now`. Null for missing or
 * unparseable input. Future dates clamp to 0 (bad data, not negative silence).
 */
export function daysBetween(date: string | undefined, now: Date): number | null {
  if (!date) return null;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return null;
  const days = Math.floor((now.getTime() - parsed) / 86_400_000);
  return Math.max(0, days);
}

/**
 * Computes deterministic health/velocity classifications for one record.
 * `now` is injectable so a whole pipeline run classifies against a single
 * timestamp and tests are stable.
 */
export type DealMetricsInput = Pick<
  OpportunityRecord,
  "lastActivityDate" | "updatedDate" | "createdDate" | "nextStep"
>;

export function computeDealMetrics(
  record: DealMetricsInput,
  now: Date = new Date()
): DealMetrics {
  const daysSinceLastActivity = daysBetween(record.lastActivityDate, now);
  const daysSinceLastModified = daysBetween(record.updatedDate, now);
  const daysSinceCreated = daysBetween(record.createdDate, now);
  const hasNextStep = Boolean(record.nextStep && record.nextStep.trim());

  // ── activityHealth ─────────────────────────────────────────────────────
  // From lastActivityDate: ≤7 active, 8–14 cooling, 15–30 dormant, >30 dark.
  // Fallback to Last Modified when activity date is absent, capped at
  // "cooling" within 14 days — absence of a logged activity is not positive
  // evidence of silence. "dark" requires >30 days on whichever signal exists.
  let activityHealth: ActivityHealth;
  if (daysSinceLastActivity !== null) {
    activityHealth =
      daysSinceLastActivity <= 7 ? "active" :
      daysSinceLastActivity <= 14 ? "cooling" :
      daysSinceLastActivity <= 30 ? "dormant" : "dark";
  } else if (daysSinceLastModified !== null) {
    activityHealth =
      daysSinceLastModified <= 14 ? "cooling" :
      daysSinceLastModified <= 30 ? "dormant" : "dark";
  } else {
    // No date evidence at all: incomplete data, not confirmed silence.
    activityHealth = "cooling";
  }

  // ── velocityAssessment ─────────────────────────────────────────────────
  // Stage age proxies from Last Modified (2–3 day/stage benchmark, 14-day cycle):
  //   stalled:      >8 days in stage, OR confirmed activity silence >14 days,
  //                 OR no documented next step (a deal with no next step is drifting)
  //   accelerating: <2 days in stage, next step defined, activity within 3 days
  //   on-track:     ≤4 days in stage with a next step
  //   slowing:      everything else
  const stageAgeDays = daysSinceLastModified;
  const freshestSignal = daysSinceLastActivity ?? daysSinceLastModified;

  let velocityAssessment: VelocityAssessment;
  if (
    (stageAgeDays !== null && stageAgeDays > 8) ||
    (daysSinceLastActivity !== null && daysSinceLastActivity > 14) ||
    !hasNextStep
  ) {
    velocityAssessment = "stalled";
  } else if (
    stageAgeDays !== null && stageAgeDays < 2 &&
    freshestSignal !== null && freshestSignal <= 3
  ) {
    velocityAssessment = "accelerating";
  } else if (stageAgeDays !== null && stageAgeDays <= 4) {
    velocityAssessment = "on-track";
  } else {
    velocityAssessment = "slowing";
  }

  return {
    daysSinceLastActivity,
    daysSinceLastModified,
    daysSinceCreated,
    activityHealth,
    velocityAssessment,
    isStalled: velocityAssessment === "stalled",
    hasNextStep,
  };
}
