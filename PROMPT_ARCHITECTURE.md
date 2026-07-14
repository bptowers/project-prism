# Project Prism — LLM Prompt Architecture

> Reference guide for the five-phase intelligence pipeline in `functions/src/llm/prompts.ts` (~1,359 lines, ~63KB)

---

## Philosophy

"This system does not summarise data. It interrogates it. Every prompt is designed to extract intelligence that a human analyst would need 2–3 hours to produce manually."

## Data grounding (added in the Phase 1 remediation)

The enrichment phases (2–5) receive a compact per-deal table — real deal names, accounts, reps,
MRR, stage, probability, and the code-computed health metrics — injected between the
`[BEGIN_USER_DATA]` / `[END_USER_DATA]` markers. Each of those prompts carries an explicit grounding
rule: **only cite deals, reps, accounts, and figures that appear verbatim in the data; if the data
can't answer, say "not available in source data"; never estimate or invent names or MRR.** This
replaced an earlier state where the phases were told to "name deals, quantify MRR, never hedge" but
were sent only region win rates and a few theme strings — so they fabricated the specifics. The
"be specific / cite evidence" tone now applies only to claims the injected data supports.

---

## Prompt Summary

### REGIONAL_MARKET_INTELLIGENCE (line 20)

Background context injected into all prompts. Defines the competitive landscape, buying patterns, and industry dynamics for each region (UK, Australia, New Zealand, North America). So when the LLM sees a deal lost to "AroFlo" it knows that's an Australian competitor in the plumbing/electrical space.

### SIMPRO_STAGE_REFERENCE (line 160)

Defines what each Simpro sales stage means (e.g., what "Discovery" vs "Proposal" vs "Negotiation" looks like). Gives the LLM context on where a deal sits in the sales cycle so it can assess risk and velocity accurately.

### SYSTEM_PROMPT (line 230)

The core identity. Tells the LLM it's a Revenue Intelligence Engine, not a summariser. Sets the tone — interrogate the data, be specific, cite evidence, don't hedge. This is passed as the system message on every LLM call.

### COMPREHENSIVE_ANALYSIS_PROMPT — Phase 1 (line 282)

Analyses a single opportunity in isolation. Produces: win/loss themes, risk signals, competitor mentions, sentiment score, next steps, and market signals. This runs once per deal, so 500 deals = 500 LLM calls, throttled by a single global concurrency limiter (`util/concurrency.ts`, sized by `LLM_CONCURRENCY` — default 25, prod 40), not per-batch groups. This is the only FATAL phase — the pipeline stops if it fails.

The deterministic date/threshold fields — `activityHealth`, `velocityAssessment`, days-in-stage, stall detection — are **computed in code** (`util/dealMetrics.ts`) and passed into the prompt as stated facts; the LLM no longer derives them, so two runs on the same data classify identically. The LLM output is forced into the `OpportunityAnalysis` shape via structured outputs (Claude tool-use / OpenAI `json_schema` / Gemini `responseSchema`); an unrecoverable parse or validation failure counts as a failed record rather than emitting a fake default score.

### PORTFOLIO_AGGREGATION_PROMPT — Phase 2 (line 489)

Looks at the entire aggregated portfolio and writes an executive briefing Pete could read in 60 seconds. Produces: forecast confidence score (0–100 with methodology), strategic recommendations, and portfolio-level risk assessment. NON-FATAL.

### TWENTY_QUESTIONS_PROMPT — Phase 3 (line 670)

Answers the specific strategic questions a CRO would ask in a pipeline review. Things like: what's our pipeline velocity trend, where are deals stalling, which reps are underperforming, what's our win rate by competitor, where's our coverage gap. NON-FATAL.

### COMPETITIVE_DISPLACEMENT_PROMPT — Phase 4 (line 864)

Looks across all deals to find competitive patterns. Not just "we lost to X" but why and how, across multiple deals. Produces offensive displacement strategies and defensive playbooks per competitor. Requires the aggregated view because competitive momentum only becomes visible across multiple deals. NON-FATAL.

### DELTA_INTELLIGENCE_PROMPT — Phase 5 (line 1031)

Compares today's report against the previous one (fetched from Firestore via `fetchPreviousReport()`). Finds what changed — new deals, stalled deals, accelerating deals, forecast drift, competitive momentum shifts. This is the only phase that looks backwards in time. Gracefully skips on the first run when no previous report exists. NON-FATAL.

### Utility Prompts (line 1216+)

Smaller extraction prompts used within Phase 1 for specific tasks:

- **THEME_EXTRACTION_PROMPT** — Win/loss theme extraction
- **RISK_DETECTION_PROMPT** — Risk signal identification for active deals
- **COMPETITOR_ANALYSIS_PROMPT** — Competitor mention extraction and context
- **MARKET_SIGNAL_PROMPT** — Emerging market signal identification

---

## Execution Order

```
Data Source (CSV or BigQuery)
    │
    ▼
Parse → Validate → PII Scrub
    │
    ▼
Phase 1: Individual Analysis (per opportunity, FATAL)
    │  500 deals = 500 LLM calls, throttled by one global concurrency
    │  limiter (LLM_CONCURRENCY; default 25, prod 40)
    │
    ▼
AGGREGATION (pure code, no LLM)
    │  Combines all individual analyses into one portfolio report
    │  Regional totals, win rates, pipeline value, competitor frequency
    │
    ▼ ─── Phases 2-5 run sequentially, each receiving the aggregated report ───
    │
Phase 2: Portfolio Aggregation → Executive briefing, recommendations
    │
Phase 3: Twenty Questions → CRO intelligence answers
    │
Phase 4: Competitive Displacement → Per-competitor strategies
    │
Phase 5: Delta Intelligence → Temporal comparison (current vs previous report)
    │
    ▼
Store to Firestore → Dashboard reads via real-time listener
```

## Why Phases 2–5 Run After Aggregation

Phase 1 analyses each opportunity in isolation — it can identify deal-level risks, competitor presence, and sentiment, but it cannot see systemic patterns across the portfolio.

Phases 2–5 require the aggregated view: they need to see regional distributions, pipeline coverage ratios, competitive momentum across multiple deals, and forecast-weighted risk. Running them post-aggregation means they operate on the complete intelligence picture rather than fragments.

Phase 5 goes further, comparing the current aggregated report against the previous report to detect trajectory shifts over time.

All phases 2–5 are non-fatal: if any phase fails, the rest still execute and the base report remains intact.
