# PROJECT PRISM — In-Flight Revenue Intelligence Engine

**Technical Handover & Strategic Brief**
Version 5.0 — 21 May 2026
Prepared by Brad Towers, SE Manager — Simpro Group
*Confidential*

---

## Table of Contents

1. [Strategic Context: Why This App Exists](#1-strategic-context-why-this-app-exists)
2. [In-Flight Risk Signal Taxonomy](#2-in-flight-risk-signal-taxonomy)
3. [Technical Architecture](#3-technical-architecture)
4. [Current State of the Codebase](#4-current-state-of-the-codebase)
5. [What Still Needs Work](#5-what-still-needs-work)
6. [Prompt Engineering Guide](#6-prompt-engineering-guide)
7. [Environment, Build & Deploy](#7-environment-build--deploy)
8. [Salesforce Fields Reference](#8-salesforce-fields-reference)
9. [Handover Prompt for New Session](#9-handover-prompt-for-new-session)

---

## 1. Strategic Context: Why This App Exists

Project Prism is the technical implementation of Pete Mansel's (CRO, Simpro Group) AI-First CRO operating doctrine. It is not a reporting tool and it is not a win/loss analyzer. It is a revenue intelligence system designed to surface risk on **in-flight opportunities** before outcomes harden.

Simpro has a separate product called **Hindsight** for post-mortem closed-deal win/loss analysis. Prism focuses exclusively on open, active pipeline — deals that are still in flight and where intervention can still change the outcome. **Every prompt, every filter, every dashboard widget should be oriented toward deals where action is still possible.**

### 1.1 The Core Questions Prism Answers

Every time Prism runs, it should automatically answer:

- **Which deals are stalling?** (Velocity decay detection)
- **Where is the forecast soft?** (Probability vs. evidence misalignment)
- **Are we talking to the right people?** (Stakeholder and economic buyer analysis)
- **Have we gone silent on a deal?** (Activity drought detection)
- **Where is risk concentrating?** (Portfolio-level risk aggregation)
- **What changed since last time?** (Delta intelligence)

### 1.2 Pete's AI-First CRO Framework

From Pete's book "The AI-First CRO", four pillars define a reliable AI leadership system:

| Pillar | Book Definition | Prism Implementation |
|--------|----------------|---------------------|
| Inputs | Historical data, proven patterns, organizational context | BigQuery pulls live Salesforce data (267K+ records); regional market intelligence baked into prompts |
| Constraints | Separate domains of reasoning: strategic, analytical, skeptical | Five-phase pipeline separates individual deal analysis from portfolio aggregation from competitive intelligence |
| Memory | Persistent patterns, past interventions, failure modes | Delta Intelligence (Phase 5) compares current run against previous report in Firestore |
| Feedback Loops | Did it work? What signal preceded recovery? | Run-over-run comparison; scheduled execution every 3 days builds temporal awareness |

### 1.3 Key Concepts to Embed in Prompts

- **Signal Over Stories:** Prioritize conversion trends, velocity shifts, coverage quality, and pricing behavior over narratives. "Deals feel good" is not intelligence.
- **Early Action Beats Late Precision:** Surface directional risk even with partial data. Better to flag a deal that might be stalling than to wait until it's definitively dead.
- **Governance Over Heroics:** Define inspection cadence, decision thresholds, and escalation rules — not depend on individual heroics.
- **Forecasting as Governance:** Don't ask "Do you commit this deal?" Ask "Which indicators are deviating from standard?"
- **The Kaizen Problem-Solving Loop:** Problem Identification → Problem Statement → TAGS (Trend/Actual/Goal/Standard) → Root Cause → Countermeasures → Sustainment.
- **Silent Drift:** The most dangerous failure isn't collapse — it's slow decay. Conversion rates soften, sales cycles lengthen, discounting increases. Each change feels small. Together, they compound.

---

## 2. In-Flight Risk Signal Taxonomy

This is the creative heart of what Prism detects. The Phase 1 prompt has already been rewritten to score each open deal against these signals.

### 2.1 Data-Derivable Risk Signals

#### Velocity & Timing

- **Velocity Decay:** Deal in the same stage longer than regional/segment average.
- **Close Date Slippage:** Close date pushed into the future vs. previous run (detectable via Delta Intelligence).
- **Aging Open Pipeline:** Days since creation vs. typical sales cycle for that deal type/region.
- **Stage Regression:** Deal moved backwards in the pipeline.
- **Quarter-End Clustering:** Close dates suspiciously clustered at quarter-end (commitment theater).

#### Activity & Engagement

- **Activity Drought:** No activity logged in X days (LastActivityDate). Thresholds: 7 days = cooling, 14 days = dormant, 30 days = dark.
- **Missing Next Steps:** NextStep field empty or vague on a mid-to-late-stage deal.
- **Last Modified Staleness:** Opportunity record not updated (_fivetran_synced). Rep has mentally moved on.

#### Deal Quality & Structure

- **No Economic Buyer:** Economic buyer field empty past Discovery stage.
- **Probability Misalignment:** High probability (>60%) on early-stage deal, or low (<30%) on late-stage.
- **Forecast Category Mismatch:** "Commit" on a deal with no activity in 14 days.
- **Sparse CRM Data:** Multiple key fields empty = rep disengagement signal.

#### Portfolio-Level

- **Concentration Risk:** Too much pipeline value in too few deals for a region/rep.
- **Rep Overload:** One rep carrying disproportionate pipeline vs. peers.
- **Coverage Gap:** Pipeline coverage ratio below threshold.
- **Deal Size Anomalies:** Deals significantly larger/smaller than segment norms.

### 2.2 LLM-Derivable Risk Signals

- **Competitor Pressure:** Active competitor mentions in notes, cross-referenced against regional landscape.
- **Sentiment Drift:** Negative/uncertain language ("waiting to hear back", "budget concerns", "re-evaluating").
- **MEDDIC Gap Detection:** Missing champion, quantified pain, decision process, paper process.
- **Pricing Pressure:** Discounting language, competitor pricing mentions.
- **Single-Threading Risk:** Only one contact referenced — fragile deal.

### 2.3 Risk Scoring Model

| Signal Category | Weight | Rationale |
|----------------|--------|-----------|
| Activity Drought | High (25%) | No activity = no momentum. Pete's #1 leading indicator. |
| Velocity Decay | High (20%) | Stalling deals silently kill forecast accuracy. |
| Close Date Slippage | Medium (15%) | Repeated slippage compounds — detectable via delta runs. |
| Missing Economic Buyer / MEDDIC Gaps | Medium (15%) | Without a buyer, nothing closes. |
| Competitor Pressure | Medium (10%) | Active competitive threat on in-flight deals. |
| Probability / Forecast Misalignment | Low (10%) | Optimism bias or sandbagging. |
| Sparse CRM Data | Low (5%) | Rep disengagement signal. |

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, Vite, TypeScript, Framer Motion, custom design tokens |
| Backend | Firebase Cloud Functions v2 (Cloud Run), Node.js 20, TypeScript |
| Database | Cloud Firestore (reports, analyses, executions collections) |
| Data Source | BigQuery (cross-project query to edw-simprogroup-propagation), CSV upload fallback |
| ETL | Fivetran (Salesforce → BigQuery, converts columns to lowercase snake_case) |
| LLM | Gemini 2.5 Flash (primary), Claude and OpenAI available via Factory pattern |
| Auth | Firebase Auth. All HTTP endpoints require Bearer token. |
| Hosting | Firebase Hosting serving React SPA from hosting/dist/ |
| Firebase Project | project-prism-489108-a9e2b |

### 3.2 Repository Structure

- **`functions/`** — Firebase Cloud Functions backend (TypeScript, Node 20)
- **`hosting/`** — React dashboard frontend (Vite, React 18, TypeScript)
- **`firebase.json`** — Firebase config linking both, with hosting rewrites to function endpoints
- **`docs/`** — Architecture docs, handover documents
- **`test-data/`** — Sample CSV files for local testing
- **`sample-data/`** — Sample CSV used by frontend's hardcoded sample data flow
- **`CLAUDE.md`** — AI assistant project context (auto-read by new sessions)

### 3.3 Data Pipeline Flow

1. **Data Source:** BigQuery pulls live Salesforce records filtered to `is_closed = FALSE` (or CSV upload)
2. **Parse:** CSVParser maps Salesforce fields to internal OpportunityRecord type
3. **Validate:** DataValidator scores data quality, detects/scrubs PII
4. **Phase 1 — Individual Analysis (FATAL):** One LLM call per opportunity. Batched in groups of 25 with 600ms rate limiting. Produces deal health score, risk signals, velocity/activity/stakeholder/competitor assessments.
5. **Aggregation (pure code, no LLM):** Combines all individual analyses into portfolio-level report. Regional totals, pipeline value, risk distribution.
6. **Phase 2 — Portfolio Aggregation (NON-FATAL):** Pipeline health brief, forecast integrity, cross-regional intelligence, strategic recommendations.
7. **Phase 3 — Ten CRO Questions (NON-FATAL):** In-flight pipeline intelligence questions (silent deals, slipped dates, coverage gaps, rep risk concentration, etc.).
8. **Phase 4 — Competitive Displacement (NON-FATAL):** Per-competitor strategies and patterns across the portfolio.
9. **Phase 5 — Delta Intelligence (NON-FATAL):** Compares current report against previous run. Trajectory shifts, new risks, accelerating/stalling deals.
10. **Store:** Results written to Firestore. Dashboard reads via real-time listener.

### 3.4 Cloud Functions

| Function | Trigger | Timeout | Memory | Purpose |
|----------|---------|---------|--------|---------|
| onCSVUpload | Cloud Storage | 540s | 1 GiB | Auto-process uploaded CSVs |
| runWeeklyAnalysis | Cloud Scheduler (every 3 days, 6am UTC) | 540s | 1 GiB | Automated BigQuery pull + analysis |
| fetchFromBigQuery | HTTP POST | 3600s | 1 GiB | On-demand BigQuery pull |
| getReport | HTTP GET | 60s | 256 MiB | Fetch latest report |
| getReportHistory | HTTP GET | 60s | 256 MiB | Fetch last 10 reports |
| uploadCSV | HTTP POST | 540s | 1 GiB | Manual CSV upload endpoint |

### 3.5 Key Backend Files (functions/src/)

- **`types.ts`** — Single source of truth for all TypeScript interfaces
- **`index.ts`** — 6 Cloud Function entry points, `getLLMConfig()`, `runAnalysisPipeline()`, `fetchPreviousReport()`, `runAdvancedEnrichment()`, `requireAuth()` middleware, `trimReportForStorage()` (caps unbounded arrays before Firestore writes)
- **`llm/prompts.ts`** — All LLM prompts (~1,372 lines, ~75KB). **Already rewritten for in-flight deal health focus.** This is the brain of the system.
- **`llm/provider.ts`** — ILLMProvider interface and Factory pattern. Runtime-swappable via env vars.
- **`llm/gemini.ts`** — Gemini provider (primary). Google AI Studio, JSON response mode, 600ms rate limiting.
- **`llm/claude.ts`** — Claude provider (fallback)
- **`llm/openai.ts`** — OpenAI provider (fallback)
- **`pipeline/bigquerySource.ts`** — BigQuery data source. **Already filters for `is_closed = FALSE`.** Handles COALESCE column resolution for Fivetran snake_case.
- **`pipeline/csvParser.ts`** — CSV ingestion with Salesforce field mapping and region auto-detection
- **`pipeline/validator.ts`** — Data quality scoring and PII detection/scrubbing
- **`analysis/analyzer.ts`** — Orchestrates batched LLM processing (25 records/batch, parallel via Promise.all)
- **`analysis/aggregator.ts`** — Generates regional and global reports. `enrichWithLLM()` runs Phases 2–5.
- **`transforms/reportTransformer.ts`** — Converts AggregatedReport → frontend RegionData shape. Phase 3–5 fields passed through.

### 3.6 Frontend Architecture

React SPA with Vite. Uses `@/` path alias (mapped to `src/`).

**Dashboard layout (top to bottom in App.tsx):**

| Component | Phase Data | Purpose |
|-----------|-----------|---------|
| Header + UploadModal | — | Top bar with CSV upload trigger |
| PrismBar | — | Visual identity bar |
| Live/Sample Indicator | — | Shows live vs. no-data state |
| AIBriefing | Phase 1 + 2 | Executive briefing with fallback for in-progress enrichment |
| **RiskRadar** | **Phase 1** | **Hero position. Top at-risk deals with risk signals. 36KB component — the largest and most complex widget.** |
| StatsRow | Phase 1 | Key metrics: win rate, pipeline value, average deal size |
| RegionTabs | — | Filter by region (Global, UK, ANZ, Americas) |
| PipelineFunnel | Phase 1 | Visual funnel showing deal stages |
| 3-col Grid | Phase 1 | Win Themes, Loss Themes, Market Signals |
| TrendChart | Phase 1 | Historical trend visualization |
| CompetitorIntel | Phase 1 | Competitor activity analysis |
| Recommendations | Phase 2 | Actionable recommendations |
| TwentyQuestions | Phase 3 | CRO intelligence — expandable Q&A format |
| CompetitiveDisplacement | Phase 4 | Per-region win/loss mechanism analysis |
| DeltaIntelligence | Phase 5 | Period-over-period comparison, trajectory, early warnings |
| ProcessingFooter | — | Pipeline processing status |

**All Phase 3–5 dashboard widgets are built and deployed.** They render nothing gracefully when enrichment data is absent (backward compatible with older reports).

### 3.7 Firestore Collections

- `/reports/{date}` — Aggregated reports by date. Full AggregatedReport + transformed RegionData + all Phase 2–5 enrichment data.
- `/analyses/{execId}/opportunities/{oppId}` — Individual LLM analyses per opportunity.
- `/executions/{execId}` — Pipeline execution logs with status, timing, errors.

---

## 4. Current State of the Codebase

### 4.1 What's Working (as of May 2026)

- **BigQuery integration live** — successfully pulling from sf_opportunity (267K+ rows in warehouse, limited to 500 per run)
- **BigQuery WHERE clause implemented** — filters to `is_closed = FALSE` (open pipeline only)
- **Phase 1 prompt fully rewritten** for in-flight deal health (deal health score, velocity assessment, activity health, stakeholder coverage, competitor threat, recommended actions)
- **Phase 2 prompt rewritten** as pipeline health brief with forecast integrity assessment and cross-regional intelligence
- **Phase 3 prompt rewritten** with 10 in-flight CRO questions (silent deals, slipped dates, coverage gaps, probability misalignment, etc.)
- **All five LLM pipeline phases complete end-to-end**
- **Gemini 2.5 Flash** is the current primary LLM (upgraded from gemini-3.1-pro-preview)
- **All Phase 3–5 dashboard widgets built** (TwentyQuestions, CompetitiveDisplacement, DeltaIntelligence)
- **RiskRadar in hero position** — first widget after AIBriefing, most complex component (36KB)
- **Firestore batch + doc size limits fixed** — `trimReportForStorage()` caps unbounded arrays; `FIRESTORE_BATCH_SIZE=400` chunks large writes
- **Scheduled execution configured** (Cloud Scheduler, every 3 days at 6am UTC)
- **Multi-provider LLM support** (Gemini, Claude, OpenAI) via Factory pattern
- **CSV upload fallback** works via dashboard UI

### 4.2 Known Issues & History

**Issue 1 — runWeeklyAnalysis failures (March 26, fixed):**
The scheduled function was failing with HTTP 500/502. Root cause: BQ_LIMIT had been raised to 2000 and LLM_MAX_TOKENS to 10000, causing timeout and quota issues. Also hit Firestore's 500-op batch limit and 1 MiB document size limit at 2000 records. All fixed — batch chunking added, doc trimming added, .env reverted to safe values.

**Issue 2 — BigQuery IAM (March, resolved):**
10-day debugging effort. Initial mistake was granting permissions to the App Engine SA instead of the Compute Engine default SA (`898431129113-compute@developer.gserviceaccount.com`). Resolved by Baba (data team) on March 25.

**Issue 3 — .env values are baked at deploy time:**
If you change `functions/.env`, you MUST rebuild and redeploy. Values are compiled into the Cloud Run container.

---

## 5. What Still Needs Work

### 5.1 Dashboard Refinement

- **Win/Loss Themes grid still present** — the 3-column grid (Win Themes, Loss Themes, Market Signals) is a holdover from the win/loss analysis era. These should be reconsidered for an in-flight focus. Possible replacements: risk distribution by stage, activity health heatmap, forecast integrity breakdown.
- **StatsRow still shows win rate** — this metric belongs in Hindsight, not Prism. Should show pipeline health metrics instead (% at risk, avg deal health score, days to close).
- **Deal-level drill-down** — clicking a deal in RiskRadar should show individual risk signals, LLM reasoning, and recommended action. Not yet implemented.

### 5.2 Pipeline & Backend

- **BQ_LIMIT is 500** — conservative but stable. Can potentially increase to 750–1000 once pipeline timing is confirmed safe within the 540s timeout.
- **Deal velocity data source** — the CRO Intelligence widget has placeholder velocity data. Needs real stage-duration benchmarks.
- **Schema discovery** — automatic BigQuery column detection not yet implemented (currently uses hardcoded COALESCE fallbacks).

### 5.3 Operational

- **Migrate from personal API key to corporate Simpro key** — currently using a personal Anthropic key in Secret Manager.
- **Set up API spend alerts** for Gemini/Anthropic/OpenAI.
- **Evaluate tiered model strategy** — e.g., Haiku for Phase 1 (high volume), Sonnet for Phases 2–5 (portfolio-level reasoning).

---

## 6. Prompt Engineering Guide

The prompts in `functions/src/llm/prompts.ts` are the brain of the system (~1,372 lines, ~75KB).

### 6.1 Prompt Architecture

| Prompt | ~Line | Status | Purpose |
|--------|-------|--------|---------|
| REGIONAL_MARKET_INTELLIGENCE | ~20 | Done | Competitive landscape per region (UK, AU, NZ, NA). Injected into all prompts. |
| SIMPRO_STAGE_REFERENCE | ~160 | Done | What each Simpro sales stage means. |
| SYSTEM_PROMPT | ~230 | Done | Core identity: "Revenue Intelligence Engine." |
| COMPREHENSIVE_ANALYSIS_PROMPT | ~282 | **Rewritten** | Phase 1. Per-opportunity deal health diagnostics. Produces dealHealthScore, velocityAssessment, activityHealth, stakeholderCoverage, competitorThreat, recommendedAction. |
| PORTFOLIO_AGGREGATION_PROMPT | ~489 | **Rewritten** | Phase 2. Pipeline health brief with forecast integrity, ghost-stripped pipeline, cross-regional intelligence. |
| TWENTY_QUESTIONS_PROMPT | ~699 | **Rewritten** | Phase 3. Ten in-flight CRO questions (silent deals, slipped dates, coverage, rep risk, etc.) |
| COMPETITIVE_DISPLACEMENT_PROMPT | ~864 | Aligned | Phase 4. Per-competitor strategies. Was already in-flight focused. |
| DELTA_INTELLIGENCE_PROMPT | ~1031 | Aligned | Phase 5. Temporal comparison with previous report. |

### 6.2 Key Conventions

- LLM prompts wrap user data between `[BEGIN_USER_DATA]` / `[END_USER_DATA]` markers to prevent prompt injection
- All TypeScript imports use `.js` extensions (required for ESM module resolution)
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` are Firebase Secrets (declared in function config)
- Phase 1 is FATAL — pipeline stops if it fails. Phases 2–5 are NON-FATAL (wrapped in try/catch).
- The enrichment pattern: base report stored immediately after aggregation, then `enrichWithLLM()` adds phases 2–5 as non-fatal follow-up updates with `merge:true`

---

## 7. Environment, Build & Deploy

### 7.1 Current Environment (functions/.env)

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=16384
BQ_PROJECT_ID=edw-simprogroup-propagation
BQ_DATASET=SF_Simpro
BQ_TABLE=sf_opportunity
BQ_LOCATION=US
BQ_LIMIT=500
```

**API Keys:** Stored in Firebase Secret Manager, not in .env. Set via `firebase functions:secrets:set GEMINI_API_KEY`.

**Service Account:** Cloud Run uses the Compute Engine default SA (`898431129113-compute@developer.gserviceaccount.com`). Has BigQuery Data Viewer and Job User roles on `edw-simprogroup-propagation`.

### 7.2 Build & Deploy Commands

```bash
# Frontend
cd hosting && npm install && npm run build

# Backend
cd functions && npm install && npm run build

# Deploy
firebase deploy                    # everything
firebase deploy --only functions   # backend only
firebase deploy --only hosting     # frontend only

# Local dev
cd hosting && npm run dev          # Vite dev server (auto-connects to emulators)
npm run serve                      # from root — starts all Firebase emulators
```

### 7.3 API Route Rewrites (firebase.json)

- `/api/report` → `getReport`
- `/api/report/history` → `getReportHistory`
- `/api/upload` → `uploadCSV`
- `/api/bigquery` → `fetchFromBigQuery`

### 7.4 Log Inspection

GCP Console → Cloud Logging. Filter: `resource.type="cloud_run_revision"` (NOT `"cloud_function"`). Filter by execution ID prefix: `csv-upload-*`, `scheduled-bigquery-*`, `bigquery-fetch-*`.

---

## 8. Salesforce Fields Reference

Fields available in the `sf_opportunity` table (Fivetran snake_case with COALESCE fallbacks):

| Internal Field | BQ Column(s) | Use for Risk Detection |
|---------------|-------------|----------------------|
| stage | stage_name, StageName | Velocity decay, stage regression |
| closedDate | close_date, CloseDate | Close date slippage, quarter-end clustering |
| closed / won | is_closed / is_won | Filter for open pipeline (is_closed = false) |
| lastActivityDate | LastActivityDate | Activity drought detection |
| updatedDate | _fivetran_synced, LastModifiedDate | Record staleness, rep engagement |
| nextStep | NextStep | Missing next steps signal |
| probability | probability, Probability | Probability vs stage misalignment |
| forecastCategory | forecast_category, ForecastCategoryName | Forecast category mismatch |
| economicBuyer | economic_buyer_c | Missing economic buyer |
| amount | amount, Amount | Deal size anomalies, concentration risk |
| salesRep | owner_name, Owner_Name | Rep overload analysis |
| createdDate | created_date, CreatedDate | Aging pipeline calculation |
| notes | description, Description | Free-text analysis (sentiment, MEDDIC, competitors) |
| dealReviewNotes | deal_review_notes_c | Additional deal context |

---

## 9. Handover Prompt for New Session

Start a new Cowork session on the Project Prism folder. The session will auto-read `CLAUDE.md`. Then paste:

---

> Read `docs/Project-Prism-Handover-v5.md` — this is the comprehensive handover document for Project Prism, Simpro's in-flight revenue intelligence platform. It contains the full strategic context, risk signal taxonomy, technical architecture, current codebase state, and what still needs work. After reading it, tell me what you understand and we'll start working.

---

*End of handover document. Generated 21 May 2026. Reflects actual codebase state as of that date.*
