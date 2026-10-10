# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Prism is a **Global Revenue Intelligence Engine** that ingests Salesforce CSV exports, analyzes them with LLMs (Claude/Gemini/OpenAI), and produces structured revenue intelligence reports. It consists of a React dashboard frontend and Firebase Cloud Functions backend.

## Repository Structure

The project has two independent sub-projects at the root:

- **`functions/`** — Firebase Cloud Functions backend (TypeScript, Node 22)
- **`hosting/`** — React dashboard frontend (Vite, React 18, TypeScript)
- **`firebase.json`** — Firebase config linking both, with hosting rewrites to function endpoints
- **`docs/`** — Architecture docs, deployment guide, presentation assets
- **`test-data/`** — Sample CSV files for local testing (`sample-opportunities.csv`, `sample-3-opportunities.csv`)
- **`sample-data/`** — Additional sample CSV (`opportunities.csv`) used by the frontend's hardcoded sample data flow

## Build & Development Commands

### Frontend (Dashboard)
```bash
cd hosting
npm install
npm run dev        # Vite dev server
npm run build      # tsc && vite build (output: dist/)
npm run preview    # Preview production build
```

### Backend (Cloud Functions)
```bash
cd functions
npm install
npm run build      # tsc (output: lib/)
npm run serve      # Build + Firebase emulator on localhost:5001
npm test           # Jest (ts-jest)
npm run lint       # ESLint
```

### Full Project (from project root)
```bash
npm run build              # Builds functions only
npm run serve              # Firebase emulators (functions + hosting + Firestore)
npm run deploy             # Deploy everything
npm run deploy:functions   # Deploy functions only
npm run deploy:hosting     # Deploy hosting only
```

### Local Testing with Emulators
The Firebase emulator suite runs these services:
- **Functions**: port 5001
- **Firestore**: port 8080
- **Storage**: port 9199
- **Auth**: port 9099
- **PubSub**: port 8085
- **Emulator UI**: port 4000

The frontend auto-connects to emulators when running in dev mode (`import.meta.env.DEV` in `hosting/src/lib/firebase.ts`).

To test the full pipeline locally:
1. `cd functions && npm run build`
2. From root: `npm run serve` (starts all emulators)
3. In another terminal: `cd hosting && npm run dev`
4. Upload a CSV via the dashboard or `curl -X POST http://localhost:5001/<project>/us-central1/uploadCSV`

## Architecture

### Backend Pipeline (functions)
The data flow is: **CSV Upload → Parse → Validate → LLM Analysis → Aggregate → Transform → Store → API**

Key layers in `functions/src/`:
- **`types.ts`** — Single source of truth for all TypeScript interfaces (OpportunityRecord, OpportunityAnalysis, AggregatedReport, etc.). `OpportunityAnalysis` models in-flight deal health (dealHealthScore, velocityAssessment, activityHealth, stakeholderCoverage, competitorThreat, riskSignals, narrativeGap, recommendedAction with P1/P2/P3 priority).
- **`index.ts`** — 6 Cloud Function entry points (see below)
- **`llm/`** — LLM provider abstraction using Factory pattern. `provider.ts` defines the `ILLMProvider` interface — `analyze()` for per-deal analysis and `complete(userPrompt, options?)` for the free-form portfolio/enrichment prompts (returns `{text, tokensUsed}`); `claude.ts`, `gemini.ts`, `openai.ts` implement both. `prompts.ts` has all prompt templates (COMPREHENSIVE_ANALYSIS_PROMPT, PORTFOLIO_AGGREGATION_PROMPT, TWENTY_QUESTIONS_PROMPT, COMPETITIVE_DISPLACEMENT_PROMPT, DELTA_INTELLIGENCE_PROMPT). Per-provider default models (in `llm/config.ts` `getLLMConfig`): Claude `claude-sonnet-4-6`, Gemini `gemini-2.5-flash`, OpenAI `gpt-4o`. The upload modal can override provider per-CSV via Storage object metadata (`event.data.metadata?.provider`).
- **`pipeline/`** — `csvParser.ts` handles CSV ingestion with Salesforce field mapping, composite field builders, and region auto-detection. `validator.ts` does data quality scoring and PII detection/scrubbing. BigQuery source filters to open opportunities only (`winLossStatus = 'active'`).
- **`analysis/`** — `analyzer.ts` orchestrates per-deal LLM processing through a single global concurrency limiter (`util/concurrency.ts` `mapWithConcurrency`), sized by `LLM_CONCURRENCY` (default `DEFAULT_CONCURRENCY = 25`; prod `.env` sets 40). Wall-clock scales roughly inversely with the cap, tuned to finish a ~260-deal run inside the 540s function timeout. `aggregator.ts` generates regional and global reports from individual analyses; `enrichWithLLM()` runs up to 5 enrichment phases (see below) via `provider.complete()`. `analysis/dealMetrics.ts` computes the deterministic date/threshold fields (`activityHealth`, `velocityAssessment`, days-in-stage, stall detection) in code rather than delegating them to the LLM.
- **`transforms/`** — `reportTransformer.ts` converts backend `AggregatedReport` into the frontend `RegionData` shape for the dashboard.
- **`util/`** — `concurrency.ts` (`mapWithConcurrency` order-preserving pool), `cost.ts` (`estimateCostUsd(model, usage)` — approximate per-provider price table), `allowedDomains.ts` (auth allowlist + `isAllowedEmail`). Deterministic deal metrics live in `analysis/dealMetrics.ts`; the JSON-repair helpers (`extractAndParseJson`) and the enrichment shape normalisers (`enrichmentSchema.ts`) live in `llm/` and `analysis/` respectively.

### Cloud Functions
| Function | Trigger | Purpose |
|---|---|---|
| `onCSVUpload` | Cloud Storage (`uploads/*.csv` in `project-prism-489108-a9e2b.firebasestorage.app`, region `us-east1`) | Auto-process uploaded CSVs |
| `runWeeklyAnalysis` | Cloud Scheduler (cron `0 6 */3 * *` — every 3 days at 6:00 AM UTC) | Scheduled BigQuery analysis |
| `getReport` | HTTP GET | Fetch latest aggregated report |
| `getReportHistory` | HTTP GET | Fetch last 10 reports |
| `uploadCSV` | HTTP POST | Manual CSV upload |
| `fetchFromBigQuery` | HTTP POST | Pull records from BigQuery and run analysis |

### Frontend (hosting)
React SPA with Vite. Uses `@/` path alias (mapped to `src/`).

- **`src/App.tsx`** — Main layout (top to bottom): Header + UploadModal, PrismBar, live/sample data indicator, empty state (when no data), then animated content: AIBriefing → **RiskRadar** (hero position, first widget) → ActivityHealth + ForecastIntegrity + RiskByStage row → StatsRow → RegionTabs → PipelineFunnel → 3-col grid (Win Themes, Loss Themes, Market Signals) → TrendChart → CompetitorIntel → Recommendations → TwentyQuestions → CompetitiveDisplacement → DeltaIntelligence → ProcessingFooter. Uses `framer-motion` for enter animations.
- **`src/hooks/`** — `useRegion.ts` (region selection + data, plus `isLive`/`hasLiveData`/`showingContent` for live-vs-sample toggle), `useFirestore.ts` (Firestore queries; loads `/reports/{date}` plus the `/reports/{date}/deals` subcollection), `useUpload.ts` (CSV upload)
- **`src/components/dashboard/`** — Dashboard widgets: AIBriefing, StatsRow, RegionTabs, PipelineFunnel, ThemeChart, RiskRadar, ActivityHealth, ForecastIntegrity, RiskByStage, RepHeatmap, DealDetailModal, MarketSignals, TrendChart, CompetitorIntel, Recommendations, TwentyQuestions, CompetitiveDisplacement, DeltaIntelligence, UploadModal
- **`src/components/ui/`** — Reusable UI primitives (Panel, Badge, Button, Sparkline)
- **`src/components/layout/`** — Layout components (Header, PrismBar, ProcessingFooter)
- **`src/data/sampleData.ts`** — Hardcoded sample data for development
- **`src/theme/`** — ThemeProvider with light/dark mode, design tokens (`tokens.ts`), animations (`animations.ts`)
- **`src/lib/firebase.ts`** — Firebase client init with automatic emulator connection in dev
- **`src/lib/types.ts`** — Frontend-specific type definitions. `RegionData` is the core per-region data shape. Also defines typed interfaces for the three enrichment overlays: `TwentyQuestionsData` (10 CRO questions), `CompetitiveDisplacementData`, and `DeltaIntelligenceData` (pipeline trajectory, deal-level changes, early warnings).

### Firestore Collections
- `/reports/{date}` — Aggregated reports by date (trimmed payload — see Firestore 1 MiB notes below)
- `/reports/{date}/deals/{opportunityId}` — Full uncapped per-deal records, written in batches of 500. Added to remove the 50-deal-per-region cap that was needed to keep the main doc under 1 MiB. The frontend `useFirestore` hook fetches this subcollection alongside the main doc.
- `/analyses/{executionId}/opportunities/{opportunityId}` — Individual LLM analyses (chunked at 400 ops/batch — under Firestore's 500-ops/batch hard limit)
- `/executions/{executionId}` — Pipeline execution logs

## Environment Variables

Both sub-projects have `.env.example` files. Copy to `.env` and populate.

### Backend (`functions/.env`)
```
ANTHROPIC_API_KEY=<key>   # Secret Manager in prod; provider-specific names only (no generic fallback)
GEMINI_API_KEY=<key>
OPENAI_API_KEY=<key>
LLM_PROVIDER=claude|gemini|openai
LLM_MODEL=claude-sonnet-4-6   # generic default; per-provider overrides: CLAUDE_MODEL, GEMINI_MODEL (default gemini-2.5-flash), OPENAI_MODEL (default gpt-4o)
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=16384          # output-token cap (code default 16384); Gemini 2.5's hidden "thinking" tokens
                             # count against this, so keep it high (prod .env uses 65536).
                             # Too low → enrichment JSON truncates and the phase is skipped.
LLM_CONCURRENCY=25           # global cap on simultaneous per-deal LLM calls (prod uses 40)

# BigQuery data source (cross-project, required for fetchFromBigQuery)
BQ_PROJECT_ID=<data-warehouse-project-id>
BQ_DATASET=<dataset-name>
BQ_TABLE=<table-name>
BQ_LOCATION=US
BQ_LIMIT=300
BQ_CREATED_MONTHS=18
```

BigQuery pulls (scheduled and manual) include only expected close dates in the current and next calendar quarter, calculated in UTC: quarter start inclusive, start of the quarter after next exclusive. Undated deals are excluded. For example, September 2026 runs cover 1 July–31 December 2026; October runs cover 1 October 2026–31 March 2027. This replaces the rolling close-date lookback; legacy `BQ_CLOSE_DAYS_PAST` values are ignored. Existing open/new-business, positive-value, creation-age and optional `sinceDate` filters still apply, followed by close-date ordering and `BQ_LIMIT`. The 300-row cap can still produce an incomplete selection. CSV uploads are unaffected.

### Frontend (`hosting/.env`)
Uses Vite env vars prefixed with `VITE_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

## Key Conventions

- Backend compiles to `functions/lib/` — this is `.gitignore`d
- Frontend builds to `hosting/dist/` — also `.gitignore`d
- Firebase hosting serves from `hosting/dist` with SPA fallback (`**` → `/index.html`)
- API routes are rewired through Firebase hosting: `/api/report` → `getReport`, `/api/report/history` → `getReportHistory`, `/api/upload` → `uploadCSV`, `/api/bigquery` → `fetchFromBigQuery`
- The LLM provider is swappable at runtime via environment variables using the Factory pattern in `provider.ts`
- PII detection and scrubbing is enabled by default; `DataValidator` uses regex patterns covering email, SSN, credit card, IP address, and phone numbers (NA, UK +44, AU +61, NZ +64 formats)
- Backend uses Firebase Functions v2 APIs (`firebase-functions/v2/*`)
- All TypeScript imports within `functions/src/` use `.js` extensions (e.g., `from "./types.js"`) — required for ESM module resolution at runtime
- **Access is restricted to verified company-domain Google accounts.** The frontend uses Google sign-in (`signInWithPopup`); an `AuthGate` (`hosting/src/components/auth/AuthGate.tsx`) blocks the app until a signed-in user's email is on the allowlist. Anonymous auth was removed.
- **The domain allowlist is duplicated in four places that must be kept in sync** (rules files can't import TS, and there's no shared FE/BE package yet): `hosting/src/lib/allowedDomains.ts`, `functions/src/util/allowedDomains.ts` (both export `ALLOWED_DOMAINS` + `isAllowedEmail`), and the `allowed()` regex helper in `firestore.rules` and `storage.rules`. Current domains: `simprogroup.com`, `simpro.us`, `simpro.au`, `bigchange.com`. Adding a domain means editing all four.
- **All 4 HTTP endpoints require a Firebase ID token**: `Authorization: Bearer <idToken>`. The `requireAuth` middleware in `index.ts` verifies it via `admin.auth().verifyIdToken()` **and** rejects (403) any token whose email is off the allowlist or whose `email_verified !== true`.
- Firestore/Storage rules gate reads on the `allowed()` helper (verified email + allowlisted domain); writes from the client are always denied (Cloud Functions use Admin SDK, bypassing rules)
- LLM API keys are stored as Firebase Secret Manager secrets, not plain env vars — every function declares `secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]` in its config so any provider can be selected at runtime
- **Firestore 1 MiB document limit handling**: `index.ts` has `trimReportForStorage()` and `trimTransformedForStorage()` helpers that cap arrays/strings before writing to `/reports/{date}`. Per-deal data is split into the `/reports/{date}/deals` subcollection (full uncapped). `logDocSize()` logs JSON byte size on every write so blowouts are diagnosable — note Firestore's actual stored size is typically 2–3× the JSON byte count due to per-field overhead
- The pipeline has a **multi-phase enrichment pattern**: base report is stored immediately after aggregation, then `Aggregator.enrichWithLLM()` runs up to 5 non-fatal enrichment passes — Phase 1: executive briefing + recommendations + forecast confidence (PORTFOLIO_AGGREGATION_PROMPT); Phase 2: pipeline health narrative; Phase 3: 10 CRO questions (TWENTY_QUESTIONS_PROMPT, stored as `twentyQuestions`); Phase 4: competitive displacement intelligence (COMPETITIVE_DISPLACEMENT_PROMPT, stored as `competitiveDisplacement`); Phase 5: delta intelligence vs. prior report (DELTA_INTELLIGENCE_PROMPT, stored as `deltaIntelligence`). Each phase is independently non-fatal.
- The CSV parser handles real Salesforce export column names with composite field builders and win/loss status normalization
- LLM prompts wrap user-supplied content between `[BEGIN_USER_DATA]` / `[END_USER_DATA]` markers to prevent prompt injection
- **Single pipeline orchestrator**: the three entry points that run analysis (`onCSVUpload`, `runWeeklyAnalysis`, `fetchFromBigQuery`) all funnel through one `processAndStoreReport(records, context, llmConfig, opts?)` in `index.ts` — per-region funnel → transform → write deals subcollection → trim → base-report write → non-fatal enrichment phases → re-transform/trim/update → execution status. Fix the sequence once, not three times.
- **Same-day collision guard**: reports are keyed by date with `merge: true`, so `processAndStoreReport` stamps `activeExecutionId` on the doc at start and `stillOwnsReport()` re-checks it before each enrichment write — a second same-day run that starts mid-enrichment is skipped rather than interleaving into a chimera report.
- **Cost tracking**: every provider call returns `tokensUsed`; these accumulate on `ExecutionContext.tokenUsage` (`{input, output}`) across Phase 1 + all enrichment phases, and `estimateCostUsd()` (`util/cost.ts`) writes an approximate `$` figure to `/executions/{id}`. The price table is approximate — treat it as an order-of-magnitude signal, not billing.
