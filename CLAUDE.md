# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Prism is a **Global Revenue Intelligence Engine** that ingests Salesforce CSV exports, analyzes them with LLMs (Claude/Gemini/OpenAI), and produces structured revenue intelligence reports. It consists of a React dashboard frontend and Firebase Cloud Functions backend.

## Repository Structure

The project has two independent sub-projects at the root:

- **`functions/`** — Firebase Cloud Functions backend (TypeScript, Node 20)
- **`hosting/`** — React dashboard frontend (Vite, React 18, TypeScript)
- **`firebase.json`** — Firebase config linking both, with hosting rewrites to function endpoints
- **`docs/`** — Architecture docs, deployment guide, presentation assets
- **`test-data/`** — Sample CSV files for local testing (`sample-opportunities.csv`, `sample-3-opportunities.csv`)

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
- **`types.ts`** — Single source of truth for all TypeScript interfaces (OpportunityRecord, OpportunityAnalysis, AggregatedReport, etc.)
- **`index.ts`** — 6 Cloud Function entry points (see below)
- **`llm/`** — LLM provider abstraction using Factory pattern. `provider.ts` defines `ILLMProvider` interface; `claude.ts`, `gemini.ts`, `openai.ts` implement it. `prompts.ts` has analysis prompt templates.
- **`pipeline/`** — `csvParser.ts` handles CSV ingestion with Salesforce field mapping, composite field builders, and region auto-detection. `validator.ts` does data quality scoring and PII detection/scrubbing.
- **`analysis/`** — `analyzer.ts` orchestrates batched LLM processing (25 records/batch, concurrent processing, retry with exponential backoff). `aggregator.ts` generates regional and global reports from individual analyses.
- **`transforms/`** — `reportTransformer.ts` converts backend `AggregatedReport` into the frontend `RegionData` shape for the dashboard.

### Cloud Functions
| Function | Trigger | Purpose |
|---|---|---|
| `onCSVUpload` | Cloud Storage (gs://project-prism-uploads/) | Auto-process uploaded CSVs |
| `runWeeklyAnalysis` | Cloud Scheduler (Mon 6am UTC) | Weekly automated analysis |
| `getReport` | HTTP GET | Fetch latest aggregated report |
| `getReportHistory` | HTTP GET | Fetch last 10 reports |
| `uploadCSV` | HTTP POST | Manual CSV upload |
| `fetchFromBigQuery` | HTTP POST | Pull records from BigQuery and run analysis |

### Frontend (hosting)
React SPA with Vite. Uses `@/` path alias (mapped to `src/`).

- **`src/App.tsx`** — Main layout: Header, region tabs, 2x2 grid of panels (themes, risks, signals), trend chart, competitor intel, recommendations
- **`src/hooks/`** — `useRegion.ts` (region selection + data), `useFirestore.ts` (Firestore queries), `useUpload.ts` (CSV upload)
- **`src/components/dashboard/`** — Dashboard widgets (AIBriefing, StatsRow, PipelineFunnel, ThemeChart, RiskRadar, etc.)
- **`src/components/ui/`** — Reusable UI primitives (Panel, Badge, Button, Sparkline)
- **`src/components/layout/`** — Layout components (Header, PrismBar, ProcessingFooter)
- **`src/data/sampleData.ts`** — Hardcoded sample data for development
- **`src/theme/`** — ThemeProvider with light/dark mode, design tokens (`tokens.ts`), animations (`animations.ts`)
- **`src/lib/firebase.ts`** — Firebase client init with automatic emulator connection in dev
- **`src/lib/types.ts`** — Frontend-specific type definitions

### Firestore Collections
- `/reports/{date}` — Aggregated reports by date
- `/analyses/{executionId}/opportunities/{opportunityId}` — Individual LLM analyses
- `/executions/{executionId}` — Pipeline execution logs

## Environment Variables

Both sub-projects have `.env.example` files. Copy to `.env` and populate.

### Backend (`functions/.env`)
```
ANTHROPIC_API_KEY=<key>   # preferred; also readable as LLM_API_KEY
LLM_PROVIDER=claude|gemini|openai
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000

# BigQuery data source (cross-project, required for fetchFromBigQuery)
BQ_PROJECT_ID=<data-warehouse-project-id>
BQ_DATASET=<dataset-name>
BQ_TABLE=<table-name>
BQ_LOCATION=US
```

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
- **All 4 HTTP endpoints require a Firebase ID token**: `Authorization: Bearer <idToken>`. The `requireAuth` middleware in `index.ts` verifies this via `admin.auth().verifyIdToken()`
- Firestore rules require `request.auth != null` for reads on `reports` and `analyses`; writes from the client are always denied (Cloud Functions use Admin SDK, bypassing rules)
- `ANTHROPIC_API_KEY` is stored as a Firebase Secret Manager secret, not a plain env var — all functions declare `secrets: ["ANTHROPIC_API_KEY"]` in their config
- The pipeline has a **two-phase enrichment pattern**: base report is stored immediately after aggregation, then `Aggregator.enrichWithLLM()` adds executive briefing, recommendations, and forecast confidence as a non-fatal follow-up update
- The CSV parser handles real Salesforce export column names with composite field builders and win/loss status normalization
- LLM prompts wrap user-supplied content between `[BEGIN_USER_DATA]` / `[END_USER_DATA]` markers to prevent prompt injection
