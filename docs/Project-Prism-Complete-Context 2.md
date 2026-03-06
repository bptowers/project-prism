# Project Prism: Complete Context Document

**Author:** Brad Towers, SE Lead UK/ANZ, Simpro
**Date:** March 2026
**Purpose:** Full project context for handoff to a new development session. This document contains everything needed to understand, build, deploy, and extend Project Prism.

---

## 1. What Is Project Prism?

Project Prism is a **Global Revenue Intelligence Engine** built for Simpro. It ingests Salesforce opportunity data (via CSV upload or BigQuery pull), runs it through an AI analysis pipeline (Claude/Gemini/OpenAI), and produces structured intelligence reports including:

- Deal health scores with risk signals
- Win/loss theme extraction
- Competitor intelligence tracking
- Stage compliance assessment
- Regional aggregation and comparison
- Executive briefings with actionable recommendations

**The key differentiator:** Prism doesn't just summarise data. It infers intelligence from absence. The most important signal in Simpro's pipeline isn't what's documented; it's what's missing. A deal with no Close Plan in the Commitment stage, no Champion identified after Validation, no activity for 3 days in a 14-day sales cycle: these are the signals a CRO would act on instantly if surfaced but can never find manually across 800+ opportunities.

### Stakeholders

| Person | Role | Relationship to Prism |
|--------|------|----------------------|
| **Pete Mansel** | Chief Revenue Officer (CRO) | Executive sponsor. Initiated the project. Wants revenue intelligence for pipeline calls and board reporting. |
| **Steve Logan** | Chief Information Officer (CIO) | Technical sponsor. Helping with corporate GCP/Firebase access and infrastructure. |
| **Mike** | VP of Revenue Operations | Data stakeholder. His team owns Salesforce and BigQuery. |
| **Brad Towers** | SE Lead UK/ANZ | Builder. Writing all the code, designing the intelligence layer, managing the project. |
| **Babatunde & Bradley** | Data Warehouse Engineers | Own the BigQuery data warehouse. Working with Brad on data extraction and IAM access. |
| **Connor** | (Reports to Steve) | Setting up the corporate Firebase/GCP billing account under RevOps. |

### GitHub Repository

The codebase is on GitHub (Brad's personal account). The repo contains the full Firebase project: Cloud Functions backend, React frontend, and all configuration.

### Local Development Path

Brad's local copy: `/Users/bradtowers/Documents/Simpro SE Leadership/Project Prism`

---

## 2. Simpro's Sales Model

This is critical context because every threshold, prompt, and risk signal in Prism is calibrated for Simpro's specific sales motion.

### High-Velocity Model

Simpro is a **high-velocity SaaS business** targeting **14-day sales cycles**. This is not enterprise sales with 6-month deals. Deals move fast, and the analysis must reflect that:

- A deal with no activity for **3 days** is a warning signal (that's 20% of the entire target cycle)
- A deal in the same stage for **5+ days** is flagged as stalling
- The average time per stage is **2-3 days**

### Revenue Metric: MRR

Simpro measures revenue in **Monthly Recurring Revenue (MRR)**, not total deal value. The primary revenue field is `Expected_MRR__c`. Key thresholds:

- **Enterprise deal:** > $2,000 MRR
- **Mid-market:** $500-$2,000 MRR
- **SMB:** < $500 MRR

The `Amount` field (total contract value) exists as a fallback but MRR is the primary metric for all analysis, reporting, and thresholds.

### Simpro Sales Stages

These are the stages as defined in Simpro's Sales Stages process document:

1. **Discovery** - Initial engagement, business problem identification
   - Required: Discovery Call Date, Business Problem Confirmed, Expected MRR
2. **Validation** - Deeper qualification, champion identification
   - Required: Validation Meeting Held, Validated Office/Field Count, Champion Identified, Competitor Identified, Mutual Success Plan Shared
3. **Solution Review & Quote** - Demo, value discussion, proposal
   - Required: Demo Date, Value Discussion Held, Executive Alignment (for enterprise), Onboarding Discussed
4. **Commitment** - Verbal commit, contract negotiation
   - Required: Verbal Commit, Contract Signed
5. **Contract Review** - Final review before close
6. **Closed Won** - Deal won
   - Required: Onboarding Form Complete
7. **Closed Lost** - Deal lost

### Competitors

Primary competitors tracked: Ascora, ServiceM8, Tradify, Jobber, ServiceTitan, Housecall Pro.

---

## 3. Intelligence Architecture

Prism's intelligence operates on three tiers:

**Tier 1 - Surface Intelligence** (any dashboard can do this): Deal counts, revenue by region, stage distribution, win/loss ratios.

**Tier 2 - Pattern Intelligence** (good analytics tools do this): Stage velocity trends, competitor win rates, seasonal patterns, rep performance metrics.

**Tier 3 - Inference Intelligence** (what makes Prism unique): Reading between the lines. Detecting risk from silence. Identifying deals that look healthy but exhibit the same fingerprint as past losses.

### The 10 Non-Obvious Intelligence Patterns

These patterns inform the system prompts and should be preserved in all LLM analysis:

#### 3.1 The Ghost Fingerprint
Prospects going dark after receiving proposals/contracts. Ghost behaviour correlates with deal size relative to prospect company size. When ACV exceeds roughly 2-3% of estimated prospect revenue, decision paralysis sets in. The prospect isn't ghosting because they're uninterested; they're ghosting because the purchase requires board/partner approval they haven't secured.

**Prism should surface:** "This deal's ACV appears to exceed the prospect's typical unilateral purchasing authority. The ghosting pattern matches 73% of deals that eventually close, but only when a new stakeholder is introduced. Recommend multi-threading to an economic buyer above your current champion."

**System prompt instruction:** When a deal shows 14+ days of no activity after a proposal/quote delivery, cross-reference the deal value against company size indicators.

#### 3.2 The Boomerang Signal
Customers who left for a competitor and are now in the "boomerang window" (6-18 months) where the competitor's limitations become apparent.

**Prism should surface:** A "Boomerang Radar" ranking deals lost to competitors 6-18 months ago by likelihood of return based on the competitor's known weaknesses matching the prospect's original requirements.

**System prompt instruction:** For every Closed Lost opportunity, calculate elapsed time since loss. Between 6-18 months, flag as "Boomerang Window Open." Cross-reference original loss reason with known competitor weaknesses.

#### 3.3 Competitive Contagion Mapping
Competitor wins in a specific geography/vertical tend to generate clusters of additional mentions in nearby prospects within 4-8 weeks through word-of-mouth in trade networks.

**Prism should surface:** "Ascora has won 3 deals in [Melbourne / Plumbing] in the last 6 weeks. Historically this precedes a 2.4x increase in Ascora competitive mentions in the same cluster. 12 open opportunities match this profile."

**System prompt instruction:** Track competitive losses by geography and trade vertical. When a competitor wins 2+ deals in the same cluster within 60 days, flag all open opportunities in that cluster.

#### 3.4 Manager Attention as a Quantifiable Asset
Only ~15% of opportunities have Manager Notes. The question: what's the actual win rate of deals with Manager Notes versus without? Manager attention is a finite resource that should be allocated strategically.

**Prism should surface:** Correlation data between manager engagement and win rates, and identify current high-value deals that lack manager attention.

#### 3.5 The Implementation Anxiety Cascade
Late-stage stalls often aren't about price or product. They're about the prospect's fear of the implementation process itself. Signals: questions about data migration, training timelines, integration complexity in the notes.

**Prism should surface:** Deals where implementation anxiety is the probable blocker, with recommendations to introduce implementation/onboarding resources earlier.

#### 3.6 The Discount Decay Curve
How much revenue is lost to discounting, and whether discounting patterns correlate with specific competitors, regions, or deal sizes.

**Prism should surface:** Analysis of discount patterns and their actual impact on win rates (do discounts actually help close deals, or are they given unnecessarily?).

#### 3.7 The CFO Gate Pattern
Deals that stall at specific thresholds where CFO/board approval is typically required. Different company sizes have different approval gates.

**Prism should surface:** Deals approaching likely approval thresholds with recommendations to proactively multi-thread to financial decision-makers.

#### 3.8 The "Business Coach" Influence Signal
In the trades/field service industry, business coaches (ActionCOACH, etc.) significantly influence software purchasing decisions. Detecting their involvement changes the selling strategy.

**Prism should surface:** Deals where business coach involvement is detected or suspected, with adjusted approach recommendations.

#### 3.9 The Integration Ecosystem as a Closing Weapon
Prospects already using tools that integrate with Simpro (Xero, MYOB, QuickBooks) have lower switching costs. This should be weaponised in the sales process.

**Prism should surface:** Integration ecosystem analysis for open deals, identifying where existing tool compatibility is an untapped advantage.

#### 3.10 The Expansion Velocity Predictor
How quickly new customers expand (add users, modules, regions) predicts long-term retention and LTV. Early expansion signals should feed back into the sales process for similar prospects.

**Prism should surface:** Expansion pattern analysis that informs initial deal sizing and implementation scope recommendations.

---

## 4. Technical Architecture

### Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Dashboard UI |
| **Backend** | Firebase Cloud Functions (Node.js 20) | Analysis pipeline, API endpoints |
| **Database** | Cloud Firestore | Report storage |
| **File Storage** | Firebase Cloud Storage | CSV uploads |
| **Hosting** | Firebase Hosting | Static site serving |
| **AI/LLM** | Anthropic Claude (primary), Google Gemini, OpenAI (fallback) | Opportunity analysis |
| **Data Source** | CSV upload (current), BigQuery pull (in progress) | Salesforce data ingestion |
| **Styling** | Custom theme system ("Copper Dark") | Dark theme dashboard |

### Project Structure

```
Project Prism/
├── firebase.json              # Firebase config, emulator ports, rewrites
├── .firebaserc                # Project binding (being updated to corporate)
├── functions/                 # Cloud Functions backend
│   ├── package.json           # Dependencies: firebase-functions, @anthropic-ai/sdk, csv-parse, etc.
│   ├── .env                   # LLM API keys, BigQuery config
│   ├── src/
│   │   ├── index.ts           # Main entry: all Cloud Function definitions
│   │   ├── types.ts           # TypeScript types: OpportunityRecord, ExecutionContext, etc.
│   │   ├── pipeline/
│   │   │   ├── csvParser.ts   # CSV ingestion with COLUMN_ALTERNATIVES mapping
│   │   │   ├── validator.ts   # Record validation
│   │   │   ├── analyzer.ts    # LLM analysis orchestration (batch of 25)
│   │   │   ├── aggregator.ts  # Regional/portfolio aggregation
│   │   │   └── reportTransformer.ts  # Transform analysis into dashboard format
│   │   └── llm/
│   │       ├── prompts.ts     # System prompts for opportunity + portfolio analysis
│   │       ├── llmClient.ts   # LLM abstraction layer (Claude/Gemini/OpenAI)
│   │       └── llmConfig.ts   # Provider configuration
│   └── lib/                   # Compiled JavaScript output
├── hosting/                   # React frontend
│   ├── package.json           # Dependencies: react, recharts, papaparse, framer-motion
│   ├── .env                   # Firebase web app config (VITE_FIREBASE_*)
│   ├── src/
│   │   ├── App.tsx            # Main app with routing
│   │   ├── theme/             # Copper Dark theme system
│   │   ├── components/
│   │   │   ├── Dashboard.tsx  # Main dashboard view
│   │   │   ├── UploadModal.tsx # CSV upload UI
│   │   │   ├── RegionCard.tsx # Regional breakdown cards
│   │   │   ├── RiskPanel.tsx  # Risk signals display
│   │   │   └── ...            # Other dashboard components
│   │   ├── hooks/
│   │   │   ├── useUpload.ts   # CSV upload + pipeline trigger + polling
│   │   │   ├── useRegion.ts   # Region selection + data toggle (sample/live)
│   │   │   └── useReport.ts   # Report fetching from Firestore
│   │   └── data/
│   │       └── sampleData.ts  # Sample opportunity data for demo mode
│   └── dist/                  # Built frontend output
└── docs/                      # Project documentation
    ├── Prism-Data-Requirements-Spec.docx    # Full field specification (9 pages)
    ├── Prism-Data-Quick-Start.docx          # One-page quick start for data team
    ├── PRISM-Intelligence-Architecture.docx # Intelligence patterns + prompt strategy
    ├── AI-First-CRO-Book-Mapping.docx       # Mapping of Pete's e-book to Prism features
    ├── Project-Prism-Status-Update.pptx     # 14-slide project update deck
    ├── Prism-Data-Team-Brief.pptx           # 2-slide data team meeting deck
    └── Project-Prism-Plan.html              # Interactive Gantt chart with scenario modelling
```

### Cloud Functions (index.ts)

The main functions defined in `index.ts`:

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onCSVUpload` | Cloud Storage (file upload) | Detects CSV in `gs://project-prism-uploads/uploads/`, parses, runs pipeline, stores report |
| `uploadCSV` | HTTP POST `/api/upload` | Accepts CSV content in request body, stores to Cloud Storage |
| `getReport` | HTTP GET `/api/report` | Returns latest report from Firestore |
| `getReportHistory` | HTTP GET `/api/report/history` | Returns historical reports |
| `runWeeklyAnalysis` | Cloud Scheduler (Monday 6am UTC) | Processes latest CSV on schedule |
| `fetchFromBigQuery` | HTTP POST `/api/bigquery` (NEW) | Pulls data from BigQuery, runs pipeline |

**Key architectural insight:** `runAnalysisPipeline()` at line ~388 of `index.ts` accepts `OpportunityRecord[]` and is completely data-source-agnostic. All data sources (CSV, BigQuery, future) just need to produce an array of `OpportunityRecord` objects, and the entire downstream pipeline works unchanged.

### Firebase Configuration (firebase.json)

```json
{
  "functions": { "runtime": "nodejs20" },
  "hosting": {
    "rewrites": [
      { "source": "/api/report", "function": "getReport" },
      { "source": "/api/report/history", "function": "getReportHistory" },
      { "source": "/api/upload", "function": "uploadCSV" },
      { "source": "/api/bigquery", "function": "fetchFromBigQuery" },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "auth": { "port": 9099 },
    "pubsub": { "port": 8085 },
    "ui": { "port": 4000 }
  }
}
```

### Key TypeScript Types (types.ts)

```typescript
interface OpportunityRecord {
  opportunityId: string;
  accountName: string;
  stage: string;
  amount: number;
  expectedMRR?: number;  // Simpro's primary revenue metric
  closedDate: string;
  createdDate: string;
  updatedDate: string;
  salesRep?: string;
  region?: string;
  currency?: string;
  description?: string;
  competitorName?: string;
  lossReason?: string;
  winReason?: string;
  compositeNotes?: string;      // Concatenated from multiple free-text fields
  compositeWinLossReason?: string;
  status: "won" | "lost" | "active";
  // ... additional fields for stage compliance, custom Simpro fields
}

interface ExecutionContext {
  jobType: "csv-upload" | "scheduled-weekly" | "manual" | "api-request" | "bigquery-fetch";
  startTime: string;
  recordCount: number;
  regionsDetected: string[];
  // ... execution metadata
}
```

### LLM Configuration (functions/.env)

```env
LLM_PROVIDER=claude
LLM_API_KEY=sk-ant-...  # Anthropic API key
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000

# BigQuery Data Source (in progress)
BQ_PROJECT_ID=<pending from data team>
BQ_DATASET=<pending from data team>
BQ_TABLE=<pending from data team>
BQ_LOCATION=US
```

### Frontend Environment (hosting/.env)

```env
VITE_FIREBASE_API_KEY=<from Firebase console>
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<from Firebase console>
VITE_FIREBASE_APP_ID=<from Firebase console>
```

### CSV Parser Column Mapping

The CSV parser (`csvParser.ts`) uses a `COLUMN_ALTERNATIVES` map that accepts multiple column name formats for each field. For example, "Close Date" also matches "CloseDate", "Opportunity: Close Date", etc. This means the data team doesn't need to rename columns in their export.

### Upload Flow (useUpload.ts)

1. User selects CSV file in the dashboard
2. `parseFile()` reads and validates the file client-side using PapaParse
3. `uploadAndAnalyze()` uploads the file to Firebase Storage at `uploads/{timestamp}_{filename}`
4. Frontend then listens on Firestore `collection('reports')` for a new report document
5. The `onCSVUpload` Cloud Function triggers on the Storage upload, parses the CSV, runs the LLM analysis pipeline, and writes the report to Firestore
6. Frontend detects the new report and displays it
7. Timeout: 120 seconds on the frontend, 3600 seconds on the Cloud Function

### Region Detection

Prism auto-detects region using a 5-priority chain:
1. Territory Region field (if populated)
2. Currency (AUD = APAC, GBP = EMEA, USD = NAMER, NZD = APAC)
3. Billing State/Province
4. Billing Country
5. Account Name fallback (pattern matching)

### Sample Data Toggle

The `useRegion.ts` hook includes a toggle between sample data and live data. When `forceSample` is true (default when no live report exists), the dashboard shows pre-built sample data from `sampleData.ts`. When `useLiveData` is true, it fetches from Firestore. This lets the dashboard always have something to show.

---

## 5. LLM System Prompts

### Opportunity-Level Analysis Prompt

The core analysis prompt (`prompts.ts`) instructs the LLM to analyse individual opportunities. Key elements:

- Calibrated for **14-day sales cycles** (not 90-day enterprise cycles)
- **MRR-based thresholds**: enterprise > $2K MRR, not $100K ACV
- **Stage velocity expectations**: 2-3 days per stage is normal, 5+ days is a stall
- **Ghost Signal detection**: 3+ days no activity = warning (20% of cycle)
- **Absence-based risk signals**: missing Close Plan, missing Champion, missing Next Step
- **Simpro stage names**: Discovery, Validation, Solution Review & Quote, Commitment, Contract Review, Closed Won, Closed Lost

The prompt asks for structured JSON output including:
- Health score (0-100)
- Risk signals with severity (critical/high/medium/low)
- Win/loss themes
- Competitor intelligence
- Actionable recommendations
- Stage compliance assessment

### Portfolio/Aggregation Prompt

A second prompt analyses the full portfolio after individual analysis:
- Cross-deal pattern detection
- Regional comparison
- Rep performance signals
- Pipeline health metrics
- Executive briefing generation

---

## 6. BigQuery Integration Plan

This is the current active development work. The plan adds a Cloud Function that pulls data directly from BigQuery instead of requiring CSV uploads.

### Architecture

The downstream pipeline stays completely unchanged. We only build a "fetch and map" layer:

```
BigQuery (cross-project) --> fetchFromBigQuery Cloud Function --> OpportunityRecord[] --> existing pipeline
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `functions/package.json` | Edit | Add `@google-cloud/bigquery` dependency |
| `functions/.env` | Edit | Add BQ_PROJECT_ID, BQ_DATASET, BQ_TABLE, BQ_LOCATION |
| `functions/src/pipeline/bigquerySource.ts` | Create | BigQuery client, query builder, row mapper |
| `functions/src/index.ts` | Edit | Add `fetchFromBigQuery` HTTP function |
| `functions/src/types.ts` | Edit | Add `expectedMRR` field, extend `jobType` union |
| `firebase.json` | Edit | Add `/api/bigquery` rewrite |

### BigQuerySource Class

New module (`bigquerySource.ts`) that mirrors `csvParser.ts`:

- `fetchRecords()`: Queries BigQuery, maps rows to `OpportunityRecord[]`
- `buildQuery()`: Constructs `SELECT * FROM project.dataset.table` with optional `WHERE LastModifiedDate >= sinceDate`
- `mapRow()`: Maps BigQuery column names to OpportunityRecord fields
- `deriveWinLossStatus()`: Same logic as CSVParser
- `detectRegion()`: Same 5-priority chain as CSVParser
- `buildCompositeNotes()`: Same concatenation as CSVParser
- `buildCompositeWinLossReason()`: Same logic as CSVParser

### Field Mapping

| OpportunityRecord field | BigQuery column (SF API name) | Priority |
|---|---|---|
| `opportunityId` | `Id` | REQUIRED |
| `accountName` | `Account_Name` (or `Account.Name`) | REQUIRED |
| `stage` | `StageName` | REQUIRED |
| `amount` | `Expected_MRR__c` (fallback: `Amount`) | REQUIRED |
| `closedDate` | `CloseDate` | REQUIRED |
| `createdDate` | `CreatedDate` | REQUIRED |
| `updatedDate` | `LastModifiedDate` | REQUIRED |
| `salesRep` | `Owner_Name` (or `Owner.Name`) | RECOMMENDED |
| `region` | `Territory_Region__c` | RECOMMENDED |
| `currency` | `CurrencyIsoCode` | RECOMMENDED |
| Plus all custom fields from spec sections 2.4-2.5 | | |

### Cross-Project Authentication

BigQuery is in a different GCP project from Firebase. Setup required:

1. BigQuery engineer grants `roles/bigquery.dataViewer` to Prism's Cloud Functions service account: `<new-project-id>@appspot.gserviceaccount.com`
2. Set `BQ_PROJECT_ID` env var to the data warehouse project ID
3. No code changes needed; `@google-cloud/bigquery` handles cross-project queries via ADC + IAM automatically

For local development: `gcloud auth application-default login` with an account that has BigQuery access.

### Pending from Data Team (Babatunde & Bradley)

1. GCP project ID (for `BQ_PROJECT_ID`)
2. Dataset and table names (for `BQ_DATASET` and `BQ_TABLE`)
3. Column name confirmation (SF API names or different?)
4. IAM grant to Prism's service account

### Data Ingestion Options (After Implementation)

| Method | Trigger | Use Case |
|--------|---------|----------|
| **BigQuery pull** (new) | `POST /api/bigquery` | Primary: automated data warehouse integration |
| **CSV dashboard upload** (existing) | Cloud Storage trigger | Ad-hoc analysis, testing, fallback |
| **CSV HTTP API** (existing) | `POST /api/upload` | Integration with Airflow/dbt/orchestration tools |

---

## 7. Firebase Migration: Personal to Corporate

### Context

The project was originally built on Brad's personal Firebase account (`project-prism-69395`). It is now being migrated to a corporate Firebase project under the RevOps Cloud Billing account.

**New corporate project ID:** `project-prism-489108`

**Corporate GCP console:** `https://console.cloud.google.com/welcome/new?project=project-prism-489108`

**Important:** The Firebase console (`console.firebase.google.com`) and the GCP console (`console.cloud.google.com`) are two interfaces to the same underlying project. Firebase is a layer on top of GCP. If the project was created in the GCP console, Firebase needs to be enabled on it separately.

### Step-by-Step Migration

#### Step 1: Enable Firebase on the Corporate GCP Project

If the project was created in the GCP console (not the Firebase console), Firebase won't be enabled yet. To fix this:

1. Go to `console.firebase.google.com`
2. Click "Add project" (or "Create a project")
3. In the project name field, look for a dropdown showing existing GCP projects
4. Select `project-prism-489108` from the list
5. Walk through the Firebase setup wizard (enable Analytics or skip)

If you don't see the project in the dropdown:
- Make sure you're signed in with the same Google account that has access to the GCP project (check top-right corner of both consoles)
- The Firebase Management API may need to be enabled: go to GCP console > APIs & Services > Enable APIs > search "Firebase Management API" > Enable

Once Firebase is enabled, the project will appear in both consoles.

#### Step 2: Set Up Firebase Services

In the Firebase console for `project-prism-489108`:

1. **Firestore Database:** Go to Firestore Database > Create database. Choose "Start in production mode" and select a region (us-central1 is standard). This is where Prism stores analysis reports.

2. **Cloud Storage:** Go to Storage > Get started. This creates the default storage bucket for CSV uploads. Note the bucket name (usually `project-prism-489108.firebasestorage.app` or similar).

3. **Firebase Hosting:** Go to Hosting > Get started. This enables hosting for the React dashboard. You don't need to run the CLI setup from the console; the local config handles it.

4. **Web App Registration:** Go to Project Settings (gear icon) > General > scroll to "Your apps" > click the web icon (</>) to register a web app. Name it "Prism Dashboard" or similar. Firebase will show you the config object with apiKey, authDomain, projectId, etc. Copy these values; you'll need them for `hosting/.env`.

#### Step 3: Point Your Local Codebase at the New Project

Open a terminal and navigate to your Project Prism folder:

```bash
cd "/Users/bradtowers/Documents/Simpro SE Leadership/Project Prism"
```

Tell the Firebase CLI to use the new project. This updates the `.firebaserc` file which tracks which Firebase project you deploy to:

```bash
firebase use project-prism-489108
```

If that doesn't work (e.g., you haven't logged in with your corporate account), first authenticate:

```bash
firebase login
```

Then select or add the new project:

```bash
firebase use --add
```

Choose `project-prism-489108` from the list when prompted.

#### Step 4: Update the Frontend Configuration

Open `hosting/.env` and replace ALL values with the new project's Firebase config. You get these from Step 2 (web app registration):

```env
VITE_FIREBASE_API_KEY=<new value from Firebase console>
VITE_FIREBASE_AUTH_DOMAIN=project-prism-489108.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-prism-489108
VITE_FIREBASE_STORAGE_BUCKET=project-prism-489108.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<new value from Firebase console>
VITE_FIREBASE_APP_ID=<new value from Firebase console>
```

These values tell the React frontend which Firebase project to connect to. If these are wrong, the dashboard will fail to load data.

#### Step 5: Update Backend Environment (if needed)

The `functions/.env` file contains LLM API keys and BigQuery config. These are not project-specific, so they should work as-is. However, double-check that the file exists and has:

```env
LLM_PROVIDER=claude
LLM_API_KEY=sk-ant-...  # Your Anthropic API key
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000
```

If you're also setting up BigQuery at this stage, add the BQ variables (values pending from data team).

#### Step 6: Install Dependencies and Build

```bash
# Backend
cd functions
npm install
npm run build
cd ..

# Frontend
cd hosting
npm install
npm run build
cd ..
```

The `npm run build` for functions compiles TypeScript to JavaScript in `functions/lib/`. The `npm run build` for hosting creates the production React bundle in `hosting/dist/`.

If the functions build fails with TypeScript errors, check that `functions/tsconfig.json` targets the correct Node version and that all dependencies are installed.

#### Step 7: Deploy

```bash
firebase deploy
```

This deploys everything: Cloud Functions, Firestore rules, Storage rules, and the Hosting site. Firebase will output the hosting URL (something like `project-prism-489108.web.app`).

To deploy individual components:
```bash
firebase deploy --only functions    # Just Cloud Functions
firebase deploy --only hosting      # Just the frontend
firebase deploy --only firestore    # Just Firestore rules
firebase deploy --only storage      # Just Storage rules
```

#### Step 8: Verify

1. Open the hosting URL in your browser. The dashboard should load (with sample data since there are no reports yet).
2. Check the Firebase console > Functions to see all deployed functions.
3. Check the Firebase console > Firestore to see the empty database (it'll populate after the first analysis run).

#### Step 9: Update the BigQuery IAM Grant

The new service account for the corporate project is:

```
project-prism-489108@appspot.gserviceaccount.com
```

This is what Babatunde/Bradley need to grant `bigquery.dataViewer` permission to on their BigQuery dataset. Don't use the old personal project service account.

#### Step 10: Update GitHub (Optional)

If you want the repo to default to the corporate project, commit the updated `.firebaserc` and `hosting/.env` (but make sure the `.env` with the Anthropic API key is in `.gitignore`; never commit API keys).

### Running Locally with Emulators

For local development/testing:

```bash
# Terminal 1: Start emulators
cd "/Users/bradtowers/Documents/Simpro SE Leadership/Project Prism"
npm run serve

# Terminal 2: Start frontend dev server
cd "/Users/bradtowers/Documents/Simpro SE Leadership/Project Prism/hosting"
npm run dev
```

**Requirements:**
- **Java** is required for Firebase emulators. Install with `brew install openjdk` if not already installed.
- The Vite dev server runs on port 5173 by default.
- The Emulator UI is at `http://localhost:4000`.

**Important:** `npm run dev` in the project root does NOT work. Use `npm run serve` for emulators. Use `npm run dev` only from the `hosting/` directory for the Vite frontend.

### GCP Console vs Firebase Console

Both consoles show the same project. Use each for different tasks:

| Task | Console |
|------|---------|
| Deploy and manage the app | Firebase (`console.firebase.google.com`) |
| Manage IAM permissions | GCP (`console.cloud.google.com`) |
| View billing | GCP |
| Enable APIs (e.g., BigQuery API) | GCP > APIs & Services |
| View service accounts | GCP > IAM & Admin |
| Manage Firestore, Storage, Functions, Hosting | Firebase |
| View Cloud Function logs | Either (Firebase is simpler) |

---

## 8. Current Project Status

### What's Built (Complete)

- React dashboard with Copper Dark theme (live on Firebase)
- LLM analysis pipeline with Claude/Gemini/OpenAI support
- CSV parser with Salesforce field mapping and COLUMN_ALTERNATIVES
- Simpro sales stages and MRR calibration (14-day velocity model)
- Regional aggregation and reporting API
- Upload modal for CSV file ingestion
- Sample data for demo mode
- Cloud Functions: onCSVUpload, uploadCSV, getReport, getReportHistory, runWeeklyAnalysis
- All system prompts calibrated for Simpro's high-velocity model

### What's In Progress

- **BigQuery Cloud Function** (`fetchFromBigQuery`): Brad is building this today. The plan is confirmed, dependencies are identified, cross-project auth approach is validated.
- **Corporate Firebase migration**: New project `project-prism-489108` created under RevOps billing. Needs Firebase enabled, services configured, and code redeployed.
- **Data team coordination**: Babatunde and Bradley reviewing the Data Requirements Spec. Waiting on GCP project ID, dataset/table names, column confirmation, and IAM grant.

### What Remains

- End-to-end testing with real Salesforce data from BigQuery
- BigQuery column mapping validation (may need adjustments once actual column names are confirmed)
- 2-3 rounds of LLM prompt tuning with real data
- Edge case handling (malformed data, missing fields, large datasets)
- Report transformer debugging with live data
- Authentication for production (Storage rules currently require auth but none is configured)

### Estimated Timeline

Once real data is available: **3 weeks to working demo**

- **Week 1 (Break Things):** Ingest real CSV/BigQuery data, map columns, run first LLM analysis, identify data gaps
- **Week 2 (Fix & Tune):** Refine LLM prompts, calibrate MRR thresholds, fix parsing edge cases, build regional aggregation
- **Week 3 (Demo Ready):** End-to-end pipeline working, dashboard showing live intelligence, weekly automation configured, demo to Pete and stakeholders

### Known Risks

1. **BigQuery column names** (HIGH): If they don't use standard SF API names, the mapper needs updating. This is a config change, not a code rewrite.
2. **LLM output quality** (MEDIUM): First run with real data will produce mediocre results. Expect 2-3 prompt tuning iterations. This is normal.
3. **Edge cases in real data** (MEDIUM): Null fields, unexpected date formats, special characters in names. The CSV parser handles many of these but real data always surprises.
4. **Report transformer** (MEDIUM): The component that converts raw LLM output into dashboard-ready JSON. Most likely place for bugs with real data.

---

## 9. Key Documents Reference

All in the `docs/` folder of the project:

| Document | Purpose | Audience |
|----------|---------|----------|
| `Prism-Data-Requirements-Spec.docx` | Full field specification (9 pages). Every field Prism needs, priority levels, exact SF API names, and usage descriptions. | Data team (Babatunde, Bradley) |
| `Prism-Data-Quick-Start.docx` | One-page quick start. Just the 7 required fields + recommended fields + the ask. | Data team (first meeting) |
| `PRISM-Intelligence-Architecture.docx` | Strategic vision document. Intelligence Pyramid, all 10 non-obvious intelligence patterns, system prompt architecture, data signals taxonomy, build phases. | Pete, Steve, Brad |
| `AI-First-CRO-Book-Mapping.docx` | Maps Pete Mansel's AI-First CRO e-book chapters to Prism features. Shows how Prism implements Pete's vision. | Pete |
| `Project-Prism-Status-Update.pptx` | 14-slide project update deck. Includes honest assessment (60% complete), known risks, 3-week timeline. | Pete, Steve, Mike |
| `Prism-Data-Team-Brief.pptx` | 2-slide briefing. What Prism is + what data we need, and next steps timeline. | Data team |
| `Project-Prism-Plan.html` | Interactive Gantt chart. Dark/light theme, scenario modelling (change data arrival date and all downstream dates shift), status tracking, inline editing, localStorage persistence. | Brad, project tracking |

---

## 10. Useful Commands Reference

```bash
# Navigate to project
cd "/Users/bradtowers/Documents/Simpro SE Leadership/Project Prism"

# Switch Firebase project
firebase use project-prism-489108

# Build backend
cd functions && npm install && npm run build && cd ..

# Build frontend
cd hosting && npm install && npm run build && cd ..

# Deploy everything
firebase deploy

# Deploy just functions
firebase deploy --only functions

# Deploy just hosting
firebase deploy --only hosting

# Start local emulators (requires Java)
npm run serve

# Start frontend dev server (separate terminal)
cd hosting && npm run dev

# Install Java for emulators (if needed)
brew install openjdk
sudo ln -sfn $(brew --prefix openjdk)/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk.jdk

# BigQuery dependency (for the new Cloud Function)
cd functions && npm install @google-cloud/bigquery

# Authenticate for local BigQuery development
gcloud auth application-default login
```

---

*This document was generated from the full build history of Project Prism across multiple development sessions. All architecture decisions, intelligence patterns, prompt calibrations, and technical details are captured from the actual codebase and working sessions with Brad Towers.*
