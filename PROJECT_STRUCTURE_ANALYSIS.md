# PROJECT PRISM - COMPLETE DIRECTORY & DEPLOYMENT ANALYSIS

## Executive Summary

**Project Prism** is a Global Revenue Intelligence Engine consisting of:
- **Backend**: Firebase Cloud Functions (Node 20, TypeScript) with LLM-powered analysis
- **Frontend**: React 18 + Vite dashboard with real-time Firestore integration
- **Data Pipeline**: CSV/BigQuery ingestion → LLM analysis → Structured intelligence reports

**Firebase Project ID**: `project-prism-489108-a9e2b`

---

## 1. ROOT CONFIGURATION

### firebase.json
- Defines functions source: `functions/` (Node 20 runtime)
- Defines hosting public: `hosting/dist/` (SPA)
- Rewrites all `/api/*` routes to Cloud Functions
- Configures all emulators (Firestore:8080, Functions:5001, Storage:9199, Auth:9099)

### .firebaserc
- Default project: `project-prism-489108-a9e2b`

### Root package.json
- Scripts: `build`, `serve`, `deploy`, `deploy:functions`, `deploy:hosting`

### .gitignore
- Ignores: `.env`, `node_modules/`, `dist/`, `lib/`, logs, Salesforce CSVs

---

## 2. BACKEND: FIREBASE CLOUD FUNCTIONS

### Package.json (functions/)
- Runtime: Node 20
- Build: `tsc` (TypeScript compiler)
- Main: `lib/index.js`

### Environment Variables (.env)
```
ANTHROPIC_API_KEY=<api-key>
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000
```

### Cloud Functions (6 total)

| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `onCSVUpload` | Storage | `gs://project-prism-uploads/uploads/*.csv` | Auto-process CSVs |
| `runWeeklyAnalysis` | Scheduler | Monday 6am UTC | Weekly pipeline |
| `getReport` | HTTP GET | `/api/report` | Fetch latest report |
| `getReportHistory` | HTTP GET | `/api/report/history` | Last 10 reports |
| `uploadCSV` | HTTP POST | `/api/upload` | Manual CSV upload |
| `fetchFromBigQuery` | HTTP POST | `/api/bigquery` | Query BigQuery |

### Source Tree
```
functions/src/
├── index.ts           # 6 Cloud Functions, main pipeline orchestration
├── types.ts           # TypeScript interfaces (316 lines)
├── llm/               # LLM Provider abstraction (Factory pattern)
│   ├── provider.ts    # ILLMProvider interface
│   ├── claude.ts      # Claude via @anthropic-ai/sdk
│   ├── gemini.ts      # Google Gemini
│   ├── openai.ts      # OpenAI
│   └── prompts.ts     # Analysis prompts
├── pipeline/          # Data ingestion & validation
│   ├── csvParser.ts   # Salesforce CSV parsing
│   ├── validator.ts   # Data quality, PII detection
│   └── bigquerySource.ts  # BigQuery integration
├── analysis/          # LLM analysis & aggregation
│   ├── analyzer.ts    # Batch processing, retry logic
│   └── aggregator.ts  # Report generation
└── transforms/
    └── reportTransformer.ts  # Backend → Frontend shape
```

### Key Dependencies
- `@anthropic-ai/sdk` (Claude API)
- `firebase-admin` v12
- `firebase-functions` v5 (Cloud Functions v2 APIs)
- `@google-cloud/bigquery`
- `csv-parse`
- TypeScript 5.4.0

---

## 3. FRONTEND: REACT DASHBOARD

### Package.json (hosting/)
- Framework: React 18.3.1
- Build tool: Vite 5.4.10
- Scripts: `dev`, `build` (tsc + vite), `preview`

### Environment Variables (.env)
```
VITE_FIREBASE_API_KEY=<key>
VITE_FIREBASE_AUTH_DOMAIN=<domain>
VITE_FIREBASE_PROJECT_ID=project-prism-489108-a9e2b
VITE_FIREBASE_STORAGE_BUCKET=<bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<id>
VITE_FIREBASE_APP_ID=<id>
```

### Vite Configuration
- React plugin enabled
- Path alias: `@/` → `src/`
- Build output: `hosting/dist/`
- Source maps enabled

### Firebase Client
- Anonymous auth enabled
- Auto-connects to emulators in dev
- Firestore, Storage, Auth initialized

### Source Tree
```
hosting/src/
├── main.tsx           # React entry point
├── App.tsx            # Main dashboard layout
├── lib/
│   ├── firebase.ts    # Firebase client setup
│   └── types.ts       # Frontend interfaces
├── hooks/
│   ├── useRegion.ts   # Region state & data
│   ├── useFirestore.ts # Firestore queries
│   └── useUpload.ts   # CSV upload
├── components/
│   ├── layout/        # Header, PrismBar, ProcessingFooter
│   ├── dashboard/     # AIBriefing, Stats, Charts, Radar, Signals, Intel, Recommendations, Funnel, Trends, Tabs, Upload
│   └── ui/            # Panel, Badge, Button, Sparkline
├── data/
│   └── sampleData.ts  # Sample data for dev
└── theme/
    ├── ThemeProvider.tsx  # Light/dark mode
    ├── tokens.ts      # Design tokens
    └── animations.ts  # Framer Motion animations
```

### Dashboard Components
- **AIBriefing**: Executive summary from LLM
- **StatsRow**: KPIs (pipeline %, win rate, at-risk, velocity, forecast, threats)
- **ThemeChart**: Win/loss themes pie charts
- **RiskRadar**: At-risk deals visualization
- **MarketSignals**: Market indicators
- **CompetitorIntel**: Competitor threats
- **Recommendations**: Prioritized actions (P1/P2/P3)
- **PipelineFunnel**: Sales funnel by stage
- **TrendChart**: Multi-region trend lines
- **RegionTabs**: Region selector (All, NA, UK, ANZ)
- **UploadModal**: CSV upload dialog

### Key Dependencies
- React 18.3.1
- Firebase 10.14.0
- Framer Motion 11.11.0 (animations)
- Recharts 2.13.0 (charts)
- Papaparse 5.4.1 (CSV parsing client-side)

---

## 4. DEPLOYMENT

### Build Steps
```bash
# From root:
npm run build              # TypeScript compile functions/src → functions/lib
npm run serve              # Start Firebase emulators
npm run deploy             # Build both, deploy to Firebase
npm run deploy:functions   # Functions only
npm run deploy:hosting     # Hosting only
```

### Predeploy Hooks
- **Functions**: `npm --prefix functions run build`
- **Hosting**: `npm --prefix hosting run build`

### Build Outputs
- `functions/lib/` (compiled TypeScript, .gitignore'd)
- `hosting/dist/` (built SPA, .gitignore'd)

---

## 5. FIRESTORE & STORAGE

### Collections
- `/reports/{date}` - Aggregated reports by YYYYMMDD
  - Contains: AggregatedReport + transformed (RegionData shape)
  - Metadata: reportDate, createdAt, enrichedAt, analysisProvider

- `/analyses/{executionId}/opportunities/{opportunityId}` - Individual analyses
  - Contains: OpportunityAnalysis per opportunity

- `/executions/{executionId}` - Pipeline execution logs
  - Tracks: executionId, startTime, jobType, recordsProcessed, status, errors

### Storage Buckets
- `project-prism-uploads` - CSV staging
  - Trigger: `uploads/*.csv` → onCSVUpload
  - Cleaned after processing

### Rules
- `firestore.rules` - Firestore security
- `storage.rules` - Storage security (requires `request.auth != null`)

---

## 6. DATA FLOW

```
CSV / BigQuery Input
    ↓
CSVParser (Salesforce mapping, region detection)
    ↓
DataValidator (Quality scoring, PII detection)
    ↓
Analyzer (Batch LLM: 25 records/batch, retry logic)
    ├ LLM Provider (Claude/Gemini/OpenAI)
    └ Exponential backoff retry
    ↓
Aggregator (Regional & global reports)
    ↓
ReportTransformer (AggregatedReport → RegionData)
    ↓
Firestore (reports/, analyses/, executions/)
    ↓
React Dashboard (Firestore queries)
```

---

## 7. LOCAL DEVELOPMENT

### Emulator Ports
- Firestore: 8080
- Functions: 5001
- Storage: 9199
- Auth: 9099
- PubSub: 8085
- Emulator UI: 4000

### Start Local
```bash
cd functions && npm install && npm run build
cd hosting && npm install
npm run serve                    # All emulators
cd hosting && npm run dev        # In another terminal: Vite dev
```

### Test Data
- `test-data/sample-opportunities.csv`
- `test-data/sample-3-opportunities.csv`

---

## 8. KEY FILE PATHS

All paths relative to `/sessions/upbeat-confident-einstein/mnt/Project Prism/`

### Configuration
- `firebase.json` - Firebase project config
- `.firebaserc` - Firebase alias
- `package.json` - Root scripts
- `firestore.rules` - Firestore rules
- `storage.rules` - Storage rules

### Backend
- `functions/package.json`
- `functions/.env` (not .example)
- `functions/src/index.ts` - Cloud Functions
- `functions/src/types.ts` - Interfaces
- `functions/src/llm/` - LLM providers
- `functions/src/pipeline/` - CSV/BigQuery/Validation
- `functions/src/analysis/` - Analysis & Aggregation
- `functions/src/transforms/` - Report transformer

### Frontend
- `hosting/package.json`
- `hosting/.env` (not .example)
- `hosting/vite.config.ts`
- `hosting/src/main.tsx` - React entry
- `hosting/src/App.tsx` - Dashboard layout
- `hosting/src/lib/firebase.ts` - Firebase client
- `hosting/src/lib/types.ts` - Interfaces
- `hosting/src/components/` - UI components
- `hosting/src/hooks/` - React hooks
- `hosting/src/theme/` - Design system

### Test Data
- `test-data/sample-opportunities.csv`
- `test-data/sample-3-opportunities.csv`

---

## 9. ENVIRONMENT SETUP CHECKLIST

### Backend (functions/.env)
- [ ] Set `ANTHROPIC_API_KEY` (or `LLM_API_KEY`)
- [ ] Set `LLM_PROVIDER` (default: claude)
- [ ] Set `LLM_MODEL` (default: claude-sonnet-4-5-20250929)
- [ ] Set `LLM_TEMPERATURE` (default: 0.3)
- [ ] Set `LLM_MAX_TOKENS` (default: 2000)
- [ ] (Optional) BigQuery: `BQ_PROJECT_ID`, `BQ_DATASET`, `BQ_TABLE`

### Frontend (hosting/.env)
- [ ] Set `VITE_FIREBASE_API_KEY`
- [ ] Set `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] Set `VITE_FIREBASE_PROJECT_ID` (project-prism-489108-a9e2b)
- [ ] Set `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] Set `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] Set `VITE_FIREBASE_APP_ID`

---

## 10. PROJECT STATUS

- **Status**: Functional, deployed
- **Last Data Import**: February 2026
- **Compiled Artifacts**:
  - `functions/lib/` (TypeScript compiled)
  - `hosting/dist/` (React SPA built)
- **Git**: Main branch + feature branch
- **Docs**: Comprehensive in `/docs/` directory

---

