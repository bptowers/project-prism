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
npm test           # Jest
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

## Architecture

### Backend Pipeline (functions)
The data flow is: **CSV Upload → Parse → Validate → LLM Analysis → Aggregate → Store → API**

Key layers in `functions/src/`:
- **`types.ts`** — Single source of truth for all TypeScript interfaces (OpportunityRecord, OpportunityAnalysis, AggregatedReport, etc.)
- **`index.ts`** — 5 Cloud Function entry points (see below)
- **`llm/`** — LLM provider abstraction using Factory pattern. `provider.ts` defines `ILLMProvider` interface; `claude.ts`, `gemini.ts`, `openai.ts` implement it. `prompts.ts` has analysis prompt templates.
- **`pipeline/`** — `csvParser.ts` handles CSV ingestion with Salesforce field mapping and region auto-detection. `validator.ts` does data quality scoring and PII detection/scrubbing.
- **`analysis/`** — `analyzer.ts` orchestrates batched LLM processing (25 records/batch, retry with exponential backoff). `aggregator.ts` generates regional and global reports from individual analyses.

### 5 Cloud Functions
| Function | Trigger | Purpose |
|---|---|---|
| `onCSVUpload` | Cloud Storage (gs://project-prism-uploads/) | Auto-process uploaded CSVs |
| `runWeeklyAnalysis` | Cloud Scheduler (Mon 6am UTC) | Weekly automated analysis |
| `getReport` | HTTP GET | Fetch latest aggregated report |
| `getReportHistory` | HTTP GET | Fetch last 10 reports |
| `uploadCSV` | HTTP POST | Manual CSV upload |

### Frontend (hosting)
React SPA with Vite. Uses `@/` path alias (mapped to `src/`).

- **`src/App.tsx`** — Main layout: Header, region tabs, 2x2 grid of panels (themes, risks, signals), trend chart, competitor intel, recommendations
- **`src/hooks/`** — `useRegion.ts` (region selection + data), `useFirestore.ts` (Firestore queries), `useUpload.ts` (CSV upload)
- **`src/components/dashboard/`** — Dashboard widgets (AIBriefing, StatsRow, PipelineFunnel, ThemeChart, RiskRadar, etc.)
- **`src/components/ui/`** — Reusable UI primitives (Panel, Badge, Sparkline)
- **`src/data/sampleData.ts`** — Hardcoded sample data for development
- **`src/theme/`** — Design tokens (`tokens.ts`), animations (`animations.ts`), global CSS
- **`src/lib/firebase.ts`** — Firebase client init (uses `VITE_FIREBASE_*` env vars)

### Firestore Collections
- `/reports/{date}` — Aggregated reports by date
- `/analyses/{executionId}/opportunities/{opportunityId}` — Individual LLM analyses
- `/executions/{executionId}` — Pipeline execution logs

## Environment Variables

### Backend (functions)
```
LLM_PROVIDER=claude|gemini|openai
LLM_API_KEY=<key>
LLM_MODEL=claude-3-5-sonnet-20241022
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000
```

### Frontend (hosting)
Uses Vite env vars prefixed with `VITE_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

## Key Conventions

- Backend compiles to `functions/lib/` — this is `.gitignore`d
- Frontend builds to `hosting/dist/` — also `.gitignore`d
- Firebase hosting serves from `hosting/dist` with SPA fallback (`**` → `/index.html`)
- API routes are rewired through Firebase hosting: `/api/report` → `getReport`, `/api/upload` → `uploadCSV`
- The LLM provider is swappable at runtime via environment variables using the Factory pattern in `provider.ts`
- PII detection and scrubbing is enabled by default in the validation pipeline
