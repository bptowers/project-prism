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
- **`sample-data/`** — Additional sample CSV (`opportunities.csv`); the frontend no longer has a hardcoded sample-data flow

## Build & Development Commands

### Frontend (Dashboard)
```bash
cd hosting
npm install
npm run dev        # Vite dev server
npm run build      # tsc && vite build (output: dist/)
npm run preview    # Preview production build
npm test           # Vitest + Testing Library (jsdom), src/**/*.test.{ts,tsx}
npx tsc --noEmit   # type-check src/
npm run typecheck:rules  # type-check rules-tests/ + vitest.rules.config.ts (tsconfig.rules.json; not covered by the line above)
npm run test:rules # Firestore security-rule tests against the emulator (see note below)
```
`npm run test:rules` runs `firebase emulators:exec --only firestore`, so it needs the **global Firebase CLI** and a **JDK** (the Firestore emulator is Java). On Brad's machine: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run test:rules`.

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

- **`src/App.tsx`** — Header + UploadModal, PrismBar, sticky `DashboardNav` (one region selector + tabs), then one tab panel, then ProcessingFooter. An empty state shows until a live report exists. Every tab gets the same region-filtered deals (`inRegion`), so all tabs agree. Tabs, in order:
  - **Overview** — changes strip (`SinceLastRun`), collapsible AI briefing, KPI tiles, RiskMap, risk-drivers radar + confidence gauge, today's review queue, region cards
  - **CRO Brief** — Q10 interventions, actions, Q1–9 question cards
  - **Deals** — filters, rep summary, deal cards (riskiest first, 24 then "Show all"), CSV export of what's on screen
  - **Pipeline Health** — stage, activity, forecast, funnel, rep heatmap; each drills into Deals with a filter
  - **Competition & Change** — what changed, competitor cards, full delta and competitive analyses in disclosures

  Tab, region and Deals filters live in the URL hash via `useDashboardView`, so views are shareable and browser back works. Each tab, and each section inside it, sits behind its own `ErrorBoundary` (keyed on tab + region, so a region change remounts the tab), so one bad LLM payload never blanks the page. Uses `framer-motion` for enter animations.
- **`src/hooks/`** — `useDashboardView.ts` (tab/region/filters ↔ URL hash; last region remembered in `localStorage['prism-last-region']`), `useRegion.ts` (`useRegion(region)` takes the region from the view and returns its data plus `isLive`/`showingContent`, `regionCounts`, `dealsError` and the enrichment overlays), `useSharedReviews.ts` (live `/dealReviews` from Firestore, behind the `ReviewsApi` in `lib/reviews`), `useFirestore.ts` (loads `/reports/{date}` plus the `/reports/{date}/deals` subcollection), `useUpload.ts` (CSV upload), `useElementWidth.ts` (ResizeObserver content width for responsive charts and tabs, with a fallback for jsdom)
- **`src/components/tabs/`** — one component per tab: OverviewTab, CroBriefTab, DealsTab, PipelineHealthTab, CompetitionTab
- **`src/components/overview/`** — SinceLastRun, KpiTiles, ReviewQueue, RegionCards
- **`src/components/cro/`** — Interventions (Q10), ActionList, CroQuestionsGrid + QuestionDetail (Q1–9)
- **`src/components/deals/`** — DealFiltersBar, RepSummary, DealCard
- **`src/components/competition/`** — WhatChanged, CompetitorCards
- **`src/components/charts/`** — RiskMap, RiskDriversRadar, ConfidenceGauge
- **`src/components/reviews/`** — `ReviewsContext` (plus an in-memory `MemoryReviewsProvider` for tests) and `ReviewButton`
- **`src/components/dashboard/`** — Widgets reused inside the tabs: AIBriefing, PipelineFunnel, ActivityHealth, ForecastIntegrity, RiskByStage, RepHeatmap, DealDetailModal, CompetitiveDisplacement, DeltaIntelligence, NotGeneratedPanel, UploadModal
- **`src/components/ui/`** — Reusable UI primitives: `InsightPanel` (label + question + code-computed takeaway, the pattern every panel uses), `tone` (band text colours/names and shared styles), `ErrorBoundary`, `DealsLoadError` (warns when the full deal list failed to load, so tabs don't quietly show the capped list), Panel, Badge, Button, Sparkline
- **`src/components/layout/`** — Header (theme toggle), PrismBar, DashboardNav, ProcessingFooter
- **`src/components/auth/`** — `AuthGate` (Google sign-in + allowlist)
- **`src/theme/`** — ThemeProvider with light/dark mode, design tokens (`tokens.ts`), animations (`animations.ts`); CSS variables live in `global.css` (use those, no raw hex in components)
- **`src/lib/`** — pure, unit-tested helpers:
  - `dealMetrics` — deal scoring (`riskScore`, `riskBand`, `bandForRisk`, `revenueConfidence`, `buildRiskDimensions`). A NaN/infinite `healthScore` falls back to the level-based score.
  - `dealFilters` — `inRegion`, `applyDealFilters`, `activityBucket`, `repsIn`/`stagesIn`
  - `takeaways` — every panel takeaway, computed in code from deals or rows
  - `dashboardView` — `TABS`, URL-hash `parseHash`/`toHash`
  - `reviews` — `dealKey`, `ReviewsApi`, and the "worse since review" rule: a reviewed deal counts as not done again if its band worsened or its risk rose by `WORSE_SINCE_REVIEW_POINTS` (10)
  - `croQuestions` — Q1–9 order, region filtering of LLM rows, card stats counted from rows
  - `competitors` — competitor cards from Q6 threats + displacement loss mechanisms
  - `exportCsv` — Deals CSV export (quoted cells, formula-injection guard, non-finite numbers as empty cells)
  - `schedule` — `nextScheduledRun`, mirroring the `runWeeklyAnalysis` cron
  - `guards` — `asArray`, `isRecord`, `text()` (LLM field → display string; objects become blank instead of crashing React)
  - `format` — `formatDate` ("15 Oct 2026"), `formatCurrency`, `formatValue` (a $0 total over real deals shows "—", not a misleading $0), `normalizeStage`
  - also `regions`, `riskSignals`, `dealClassifiers`, `injectDeals`, `csvPreview`, `allowedDomains`
- **`src/lib/firebase.ts`** — Firebase client init with automatic emulator connection in dev
- **`src/lib/types.ts`** — Frontend-specific type definitions. `RegionData` is the core per-region data shape. Also defines typed interfaces for the three enrichment overlays: `TwentyQuestionsData` (10 CRO questions), `CompetitiveDisplacementData`, and `DeltaIntelligenceData` (pipeline trajectory, deal-level changes, early warnings).
- **`rules-tests/`** — Firestore security-rule tests (`@firebase/rules-unit-testing`), run by `npm run test:rules` with `vitest.rules.config.ts`

### Firestore Collections
- `/reports/{date}` — Aggregated reports by date (trimmed payload — see Firestore 1 MiB notes below)
- `/reports/{date}/deals/{opportunityId}` — Full uncapped per-deal records, written in batches of 500. Added to remove the 50-deal-per-region cap that was needed to keep the main doc under 1 MiB. The frontend `useFirestore` hook fetches this subcollection alongside the main doc.
- `/analyses/{executionId}/opportunities/{opportunityId}` — Individual LLM analyses (chunked at 400 ops/batch — under Firestore's 500-ops/batch hard limit)
- `/executions/{executionId}` — Pipeline execution logs
- `/dealReviews/{dealKey}` — Shared deal reviews `{reviewedBy, reviewedByName, reviewedAt, riskAtReview}`, written by the client (see the rule note under Key Conventions). `dealKey` comes from `lib/reviews.ts`.

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
- Firestore/Storage rules gate reads on the `allowed()` helper (verified email + allowlisted domain); writes from the client are always denied (Cloud Functions use Admin SDK, bypassing rules), except `/dealReviews`, which allowlisted users may write under a narrow rule: own email, `reviewedByName` bound to the token's name (or the email when there is none), server timestamp, fixed fields, `riskAtReview` a number in 0–100. Rule tests: `cd hosting && npm run test:rules` (Firestore emulator; needs the global Firebase CLI and a JDK, see the build commands above).
- **The dashboard follows the same "numbers from code" rule**: every takeaway figure is computed from deals or rows (`lib/takeaways.ts`, `lib/croQuestions.ts`, `lib/competitors.ts`), never parsed out of LLM prose. Where an LLM-authored count is shown (Q6 `affectedDeals`, competitor cards), it is labelled "(AI count)". The LLM-written new-deal count (`newPipeline.count`/`totalMrr`) and comparison date (`comparedTo`) are deliberately not shown in the changes strip or What Changed.
- **Theme**: the app opens in light mode; dark mode is opt-in via the header toggle and remembered per browser in `localStorage['prism-theme-choice']`. That key is written only by an explicit toggle (the OS setting and the legacy `prism-theme` key are ignored). An inline script in `hosting/index.html` applies a stored dark choice before first paint so it doesn't flash light; keep its key in sync with `ThemeProvider`.
- **The scheduler cron is mirrored**: `runWeeklyAnalysis`'s `0 6 */3 * *` (UTC) in `functions/src/index.ts` is duplicated in `hosting/src/lib/schedule.ts` for the header's "next refresh" date. Change both together.
- LLM API keys are stored as Firebase Secret Manager secrets, not plain env vars — every function declares `secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]` in its config so any provider can be selected at runtime
- **Firestore 1 MiB document limit handling**: `index.ts` has `trimReportForStorage()` and `trimTransformedForStorage()` helpers that cap arrays/strings before writing to `/reports/{date}`. Per-deal data is split into the `/reports/{date}/deals` subcollection (full uncapped). `logDocSize()` logs JSON byte size on every write so blowouts are diagnosable — note Firestore's actual stored size is typically 2–3× the JSON byte count due to per-field overhead
- The pipeline has a **multi-phase enrichment pattern**: base report is stored immediately after aggregation, then `Aggregator.enrichWithLLM()` runs up to 5 non-fatal enrichment passes — Phase 1: executive briefing + recommendations + forecast confidence (PORTFOLIO_AGGREGATION_PROMPT); Phase 2: pipeline health narrative; Phase 3: 10 CRO questions (TWENTY_QUESTIONS_PROMPT, stored as `twentyQuestions`); Phase 4: competitive displacement intelligence (COMPETITIVE_DISPLACEMENT_PROMPT, stored as `competitiveDisplacement`); Phase 5: delta intelligence vs. prior report (DELTA_INTELLIGENCE_PROMPT, stored as `deltaIntelligence`). Each phase is independently non-fatal.
- The CSV parser handles real Salesforce export column names with composite field builders and win/loss status normalization
- LLM prompts wrap user-supplied content between `[BEGIN_USER_DATA]` / `[END_USER_DATA]` markers to prevent prompt injection
- **Single pipeline orchestrator**: the three entry points that run analysis (`onCSVUpload`, `runWeeklyAnalysis`, `fetchFromBigQuery`) all funnel through one `processAndStoreReport(records, context, llmConfig, opts?)` in `index.ts` — per-region funnel → transform → write deals subcollection → trim → base-report write → non-fatal enrichment phases → re-transform/trim/update → execution status. Fix the sequence once, not three times.
- **Same-day collision guard**: reports are keyed by date with `merge: true`, so `processAndStoreReport` stamps `activeExecutionId` on the doc at start and `stillOwnsReport()` re-checks it before each enrichment write — a second same-day run that starts mid-enrichment is skipped rather than interleaving into a chimera report.
- **Numbers come from code, prose from the LLM**: `analysis/portfolioFacts.ts` `computePortfolioFacts()` computes every headline figure (risk counts, HIGH-risk/stalled/total/probability-weighted/ghost-stripped MRR, and per-region/stage/rep breakdowns). It is stored on the report as `portfolioFacts`, passed to every enrichment phase as `authoritativeFigures` (prompt grounding rule 5 says quote, never recount), and overwrites the LLM's `portfolioRisk` numbers. Add new aggregate figures there rather than asking the LLM to sum them — it miscounted 105 HIGH-risk deals as 78.
- **Deals subcollection pruning**: `storage/dealsSubcollection.ts` writes `/reports/{date}/deals` then deletes docs left over from an earlier same-day run.
- **Cost tracking**: every provider call returns `tokensUsed`; these accumulate on `ExecutionContext.tokenUsage` (`{input, output}`) across Phase 1 + all enrichment phases, and `estimateCostUsd()` (`util/cost.ts`) writes an approximate `$` figure to `/executions/{id}`. The price table is approximate — treat it as an order-of-magnitude signal, not billing.
