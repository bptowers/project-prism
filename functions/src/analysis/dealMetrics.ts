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

/**
 * What "days since last activity" was measured from:
 *  - "activity":   a real lastActivityDate (logged call/email/meeting)
 *  - "crm-change": no activity date exists, so the last CRM record change
 *                  (updatedDate) stands in. Absence of a logged activity is
 *                  not evidence of silence, so thresholds are looser on this
 *                  basis (dormant only after 14 days, never "active").
 *                  Also used when no date evidence exists at all — the day
 *                  counts are then null.
 */
export type ActivityBasis = "activity" | "crm-change";

/**
 * Days in stage (Last Modified proxy) beyond which velocity reads "stalled".
 * Shared with the COMPREHENSIVE_ANALYSIS_PROMPT "Cycle Stall" signal so the
 * computed metric and the prompt's wording can never disagree.
 */
export const STALL_DAYS = 14;

export interface DealMetrics {
  /** Whole days since lastActivityDate; null when the field is absent/unparseable */
  daysSinceLastActivity: number | null;
  /** Whole days since updatedDate (Last Modified) — proxy for stage age, no stage-entry date exists in the source data */
  daysSinceLastModified: number | null;
  /** Whole days since createdDate */
  daysSinceCreated: number | null;
  activityHealth: ActivityHealth;
  /** Which date `activityHealth` was derived from — see ActivityBasis. */
  activityBasis: ActivityBasis;
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
  // Fallback to Last Modified (basis "crm-change") when activity date is
  // absent, capped at "cooling" within 14 days — absence of a logged activity
  // is not positive evidence of silence, so a deal only reads dormant/ghost
  // after 14+ days on this basis. "dark" requires >30 days on whichever
  // signal exists.
  const activityBasis: ActivityBasis = daysSinceLastActivity !== null ? "activity" : "crm-change";
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
  //   stalled:      >STALL_DAYS in stage, OR confirmed activity silence >14 days
  //   accelerating: <2 days in stage, next step defined, activity within 3 days
  //   on-track:     ≤4 days in stage with a next step
  //   slowing:      everything else, INCLUDING a missing next step on its own —
  //                 a missing field is a data-quality gap the LLM should weigh
  //                 (it's already a Tier 3 risk signal), not proof of staleness.
  //                 A deal touched today with no next step is not "stalled";
  //                 treating a single missing field as a hard stalled fact
  //                 previously caused every deal lacking Next Step to read as
  //                 a "ghost deal" regardless of how fresh everything else was.
  const stageAgeDays = daysSinceLastModified;
  const freshestSignal = daysSinceLastActivity ?? daysSinceLastModified;

  let velocityAssessment: VelocityAssessment;
  if (
    (stageAgeDays !== null && stageAgeDays > STALL_DAYS) ||
    (daysSinceLastActivity !== null && daysSinceLastActivity > 14)
  ) {
    velocityAssessment = "stalled";
  } else if (
    hasNextStep &&
    stageAgeDays !== null && stageAgeDays < 2 &&
    freshestSignal !== null && freshestSignal <= 3
  ) {
    velocityAssessment = "accelerating";
  } else if (hasNextStep && stageAgeDays !== null && stageAgeDays <= 4) {
    velocityAssessment = "on-track";
  } else {
    velocityAssessment = "slowing";
  }

  return {
    daysSinceLastActivity,
    daysSinceLastModified,
    daysSinceCreated,
    activityHealth,
    activityBasis,
    velocityAssessment,
    isStalled: velocityAssessment === "stalled",
    hasNextStep,
  };
}
