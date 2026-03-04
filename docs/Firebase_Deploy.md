# Project Prism — Firebase Deployment Guide

**Firebase Project ID:** `project-prism-489108-a9e2b`
**Last Updated:** March 2026
**Status:** Complete — covers every step from zero to production

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Phase 1: Pre-Deployment Configuration](#phase-1-pre-deployment-configuration)
- [Phase 2: Firebase & GCP Console Setup](#phase-2-firebase--gcp-console-setup)
- [Phase 3: Code Changes Required](#phase-3-code-changes-required)
- [Phase 4: Local Emulator Testing](#phase-4-local-emulator-testing)
- [Phase 5: Production Deployment](#phase-5-production-deployment)
- [Phase 6: Verification & Testing](#phase-6-verification--testing)
- [Phase 7: Operations](#phase-7-operations)
- [Appendix A: Troubleshooting](#appendix-a-troubleshooting)
- [Appendix B: Cost Reference](#appendix-b-cost-reference)
- [Appendix C: Quick Reference Card](#appendix-c-quick-reference-card)

---

## Prerequisites

Complete every item in this section before touching anything else.

### 1. Node.js v20

Cloud Functions require Node 20 exactly.

```bash
node --version   # Must show v20.x.x
```

**Install via nvm (recommended):**
```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc

# Install and activate Node 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 2. Firebase CLI

```bash
npm install -g firebase-tools
firebase --version   # Should be 13.x or higher
```

**Log in and verify access:**
```bash
firebase login
firebase projects:list   # project-prism-489108-a9e2b should appear
```

If the project doesn't appear, ensure you're logged in with the correct Google account that owns the Firebase project.

### 3. Google Cloud CLI (gcloud)

Required for Secret Manager, IAM, and API enablement.

**macOS (Homebrew):**
```bash
brew install --cask google-cloud-sdk
```

**macOS/Linux (installer):**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL   # Restart shell
```

**Windows:**
Download and run the installer from: https://cloud.google.com/sdk/docs/install

**After installation:**
```bash
gcloud init
# Follow prompts: log in, select project project-prism-489108-a9e2b

gcloud auth application-default login
# This sets credentials used by local tools

gcloud config set project project-prism-489108-a9e2b
gcloud config get-value project   # Verify: project-prism-489108-a9e2b
```

### 4. Firebase Blaze Plan (REQUIRED)

> **Critical:** Cloud Functions cannot make outbound network calls (to Anthropic's API) on the free Spark plan. You **must** upgrade to the Blaze (pay-as-you-go) plan before deploying functions.

1. Go to [Firebase Console](https://console.firebase.google.com/project/project-prism-489108-a9e2b/usage/details)
2. Click **Upgrade** in the bottom-left
3. Select **Blaze** plan
4. Add a billing account (linked Google Cloud billing)
5. Confirm upgrade

> **Note:** The Blaze plan only charges for actual usage above free tier limits. For typical usage of Project Prism, monthly costs are $3–$20 (see Appendix B for full breakdown).

### 5. Anthropic API Key

You need a valid Anthropic API key with access to `claude-sonnet-4-5-20250929`.

- Get one at: https://console.anthropic.com/
- Format: `sk-ant-api03-...`
- Keep this ready — you'll store it in Secret Manager in Phase 2.

---

## Phase 1: Pre-Deployment Configuration

Local file setup before touching the Firebase/GCP consoles.

### 1.1 Update `.firebaserc`

The `.firebaserc` file must point to your project. Open it (at the project root) and replace the contents:

```json
{
  "projects": {
    "default": "project-prism-489108-a9e2b"
  }
}
```

Then activate it via CLI:

```bash
firebase use project-prism-489108-a9e2b
firebase use   # Verify: Active Project: project-prism-489108-a9e2b
```

### 1.2 Install All Dependencies

> **Note:** `functions/package-lock.json` is intentionally `.gitignore`d. Always use `npm install` (not `npm ci`) to generate a fresh lockfile.

```bash
# From the project root
cd "/Users/bradtowers/Documents/Simpro_SE_Leadership/Project Prism"

# Install root dependencies
npm install

# Install backend dependencies
cd functions
npm install

# Install frontend dependencies
cd ../hosting
npm install

# Return to root
cd ..
```

### 1.3 Create `functions/.env`

This file is for **local development only** (not deployed to production). It is already in `.gitignore`.

```bash
cd functions
cp .env.example .env
```

Open `functions/.env` and fill in:

```env
# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-your-key-here
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000

# BigQuery (leave blank if not using BigQuery integration)
BQ_PROJECT_ID=
BQ_DATASET=
BQ_TABLE=
BQ_LOCATION=US
```

### 1.4 Create `functions/.env.production`

This file provides non-secret runtime configuration for deployed functions. It is read by Firebase Functions v2 during deployment. **Do not put API keys here** — those go in Secret Manager.

Create `functions/.env.production`:

```env
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000
BQ_LOCATION=US
```

### 1.5 Create `hosting/.env` (placeholder)

The hosting `.env` needs Firebase SDK config values that you'll get in Phase 2. Create it now with placeholders so the build doesn't fail:

```bash
cd hosting
cp .env.example .env
```

Leave the placeholder values for now — you'll fill in the real values after completing Phase 2.

### 1.6 Verify TypeScript Compiles

Catch any compilation errors before deploying:

```bash
# Test backend build
cd functions
npm run build
# Expected: No errors. Output written to functions/lib/

# Test frontend build
cd ../hosting
npm run build
# Expected: No errors. Output written to hosting/dist/

cd ..
```

If either build fails, fix the TypeScript errors before proceeding.

---

## Phase 2: Firebase & GCP Console Setup

### 2.1 Enable Required GCP APIs

Run all of these. Wait for each to confirm before running the next:

```bash
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable pubsub.googleapis.com
gcloud services enable iam.googleapis.com
gcloud services enable iamcredentials.googleapis.com
```

**Verify APIs are enabled:**
```bash
gcloud services list --enabled --filter="name:cloudfunctions OR name:firestore OR name:secretmanager"
```

> **No gcloud?** Enable each API manually at https://console.cloud.google.com/apis/library — search each service name and click Enable.

### 2.2 Set Up Firestore

1. Go to [Firebase Console → Firestore](https://console.firebase.google.com/project/project-prism-489108-a9e2b/firestore)
2. Click **Create database**
3. Choose **Start in production mode**
4. **Select region** — choose one and note it. All services must use the same region:
   - `nam5` (United States, multi-region) — recommended for US-based teams
   - `us-central1` — lower latency, single region
   - `australia-southeast1` — for ANZ-based teams
5. Click **Enable**

> **Important:** Write down the region you chose. You will use this same region for Cloud Storage and Cloud Functions in later steps.

**Deploy Firestore security rules:**
```bash
firebase deploy --only firestore:rules
```

Expected:
```
✔  firestore: released rules firestore.rules to cloud.firestore
```

### 2.3 Set Up Firebase Authentication

> **Critical:** The `storage.rules` file requires `request.auth != null` for all CSV uploads. Without Firebase Auth configured, every upload from the dashboard will return a 403 Permission Denied error.

**Enable Anonymous Authentication:**
1. Go to [Firebase Console → Authentication](https://console.firebase.google.com/project/project-prism-489108-a9e2b/authentication)
2. Click **Get started**
3. Click **Anonymous** under Sign-in providers
4. Toggle **Enable** to on
5. Click **Save**

Anonymous auth allows the dashboard to silently sign in users (no login screen required) so they can upload CSVs. This is appropriate for an internal tool.

### 2.4 Create the Uploads Storage Bucket

Cloud Functions process CSVs from a dedicated bucket named `project-prism-uploads`. This is a separate bucket from Firebase's default storage bucket.

**Create via gcloud:**
```bash
# Replace REGION with the region you chose in step 2.2 (e.g., us-central1)
gcloud storage buckets create gs://project-prism-uploads \
  --project=project-prism-489108-a9e2b \
  --location=REGION \
  --uniform-bucket-level-access
```

**Or create in the Cloud Console:**
1. Go to https://console.cloud.google.com/storage/browser
2. Click **Create bucket**
3. Name: `project-prism-uploads` (must match exactly)
4. Region: same as Firestore
5. Storage class: **Standard**
6. Access control: **Uniform**
7. Click **Create**

**Deploy Storage security rules:**
```bash
firebase deploy --only storage
```

Expected:
```
✔  storage: released rules storage.rules to firebase.storage/...
```

### 2.5 Register a Firebase Web App

1. Go to [Firebase Console → Project Settings](https://console.firebase.google.com/project/project-prism-489108-a9e2b/settings/general)
2. Scroll to **Your apps** → click **Add app** → choose **Web** (`</>`)
3. App nickname: `Project Prism Dashboard`
4. Check ✅ **Also set up Firebase Hosting for this app**
5. Click **Register app**

Firebase shows your config object. **Copy all values** — you need them for `hosting/.env`:

```js
// Example — your values will differ
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "project-prism-489108-a9e2b.firebaseapp.com",
  projectId: "project-prism-489108-a9e2b",
  storageBucket: "project-prism-489108-a9e2b.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

**Alternatively, get the config via CLI:**
```bash
firebase apps:sdkconfig WEB --project project-prism-489108-a9e2b
```

**Update `hosting/.env` with real values:**

Open `hosting/.env` and replace the placeholders:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=project-prism-489108-a9e2b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-prism-489108-a9e2b
VITE_FIREBASE_STORAGE_BUCKET=project-prism-489108-a9e2b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890abcdef
```

> **Never commit this file.** It is already in `hosting/.gitignore`.

### 2.6 Store the Anthropic API Key in Secret Manager

```bash
# Create the secret (prompts for value if you omit --data-file)
echo -n "sk-ant-your-actual-key-here" | gcloud secrets create ANTHROPIC_API_KEY \
  --data-file=- \
  --project=project-prism-489108-a9e2b

# Verify it was created
gcloud secrets list --project=project-prism-489108-a9e2b
```

**Grant Cloud Functions access to the secret:**

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe project-prism-489108-a9e2b --format="value(projectNumber)")
echo "Project number: $PROJECT_NUMBER"

# Grant the default compute service account access
gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=project-prism-489108-a9e2b
```

**Verify the binding:**
```bash
gcloud secrets get-iam-policy ANTHROPIC_API_KEY --project=project-prism-489108-a9e2b
```

**Rotating the key later:**
```bash
# Add a new version
echo -n "sk-ant-new-key-here" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-

# Disable the old version (list versions first)
gcloud secrets versions list ANTHROPIC_API_KEY
gcloud secrets versions disable VERSION_NUMBER --secret=ANTHROPIC_API_KEY
```

### 2.7 BigQuery Setup (Optional)

Skip this section if you're not using the `fetchFromBigQuery` function.

The `fetchFromBigQuery` HTTP function pulls Salesforce opportunity data directly from a BigQuery dataset. To enable it:

1. Ensure the BigQuery dataset exists in a GCP project (can be a different project)
2. Grant the Cloud Functions service account access to BigQuery:

```bash
PROJECT_NUMBER=$(gcloud projects describe project-prism-489108-a9e2b --format="value(projectNumber)")

# If BigQuery is in the same project
gcloud projects add-iam-policy-binding project-prism-489108-a9e2b \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

# If BigQuery is in a different project (BQ_PROJECT_ID)
gcloud projects add-iam-policy-binding YOUR_BQ_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"
```

3. Add BigQuery config to `functions/.env` and `functions/.env.production`:

```env
BQ_PROJECT_ID=your-bigquery-project-id
BQ_DATASET=your_dataset_name
BQ_TABLE=opportunities
BQ_LOCATION=US
```

---

## Phase 3: Code Changes Required

Before deploying, two code changes are required. These are not optional — without them, the API key won't be injected into functions and CSV uploads will fail with auth errors.

### 3.1 Add `secrets` to All Cloud Function Definitions

Open `functions/src/index.ts` and add `secrets: ["ANTHROPIC_API_KEY"]` to every function that calls `getLLMConfig()`.

**Function 1: `onCSVUpload`** (line 75)

Before:
```typescript
export const onCSVUpload = onObjectFinalized(
  { bucket: "project-prism-uploads", timeoutSeconds: 3600, memory: "1GiB" },
  async (event) => {
```

After:
```typescript
export const onCSVUpload = onObjectFinalized(
  { bucket: "project-prism-uploads", timeoutSeconds: 3600, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY"] },
  async (event) => {
```

**Function 2: `runWeeklyAnalysis`** (line 180)

Before:
```typescript
export const runWeeklyAnalysis = onSchedule(
  { schedule: "0 6 * * 1", timeZone: "UTC" },
  async () => {
```

After:
```typescript
export const runWeeklyAnalysis = onSchedule(
  { schedule: "0 6 * * 1", timeZone: "UTC", secrets: ["ANTHROPIC_API_KEY"] },
  async () => {
```

**Function 3: `getReport`** (line 273)

Before:
```typescript
export const getReport = onRequest(async (_req, res) => {
```

After:
```typescript
export const getReport = onRequest({ secrets: ["ANTHROPIC_API_KEY"] }, async (_req, res) => {
```

**Function 4: `getReportHistory`** (line 315)

Before:
```typescript
export const getReportHistory = onRequest(async (_req, res) => {
```

After:
```typescript
export const getReportHistory = onRequest({ secrets: ["ANTHROPIC_API_KEY"] }, async (_req, res) => {
```

**Function 5: `uploadCSV`** (line 345)

Before:
```typescript
export const uploadCSV = onRequest(async (req, res) => {
```

After:
```typescript
export const uploadCSV = onRequest({ secrets: ["ANTHROPIC_API_KEY"] }, async (req, res) => {
```

**Function 6: `fetchFromBigQuery`** (line 390)

Before:
```typescript
export const fetchFromBigQuery = onRequest(
  { timeoutSeconds: 3600, memory: "1GiB" },
  async (req, res) => {
```

After:
```typescript
export const fetchFromBigQuery = onRequest(
  { timeoutSeconds: 3600, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY"] },
  async (req, res) => {
```

**Rebuild after editing:**
```bash
cd functions
npm run build
# Expected: No errors
```

### 3.2 Add Firebase Auth to the Frontend

The dashboard must sign in users anonymously before they can upload CSVs (required by `storage.rules`). Also add the Auth emulator connection for local development.

Open `hosting/src/lib/firebase.ts` and replace the entire file contents with:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Connect to emulators in development
if (import.meta.env.DEV) {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    console.info('Connected to Firebase emulators');
  } catch {
    // Already connected or emulators not running
  }
}

// Sign in anonymously so storage rules (request.auth != null) are satisfied
signInAnonymously(auth)
  .then(() => console.info('Signed in anonymously'))
  .catch((err) => console.warn('Anonymous sign-in failed:', err));

export default app;
```

**Rebuild the frontend after editing:**
```bash
cd hosting
npm run build
# Expected: No TypeScript errors
```

### 3.3 Verify Both Builds Pass

```bash
cd "/Users/bradtowers/Documents/Simpro_SE_Leadership/Project Prism"

cd functions && npm run build && echo "✅ Functions build OK"
cd ../hosting && npm run build && echo "✅ Hosting build OK"
cd ..
```

Both must show ✅ before continuing.

---

## Phase 4: Local Emulator Testing

Test the full pipeline locally before deploying to production. This catches issues without incurring costs or touching production data.

### 4.1 Start the Firebase Emulators

From the project root:

```bash
npm run serve
```

This starts:
| Service | Port |
|---|---|
| Emulator UI | http://localhost:4000 |
| Cloud Functions | http://localhost:5001 |
| Firestore | http://localhost:8080 |
| Cloud Storage | http://localhost:9199 |
| Firebase Auth | http://localhost:9099 |
| PubSub | http://localhost:8085 |

Wait for the output: `All emulators ready!`

### 4.2 Start the Frontend Dev Server

In a **new terminal tab**:

```bash
cd hosting
npm run dev
```

Open http://localhost:5173 in your browser. The console should log:
```
Connected to Firebase emulators
Signed in anonymously
```

### 4.3 Explore the Emulator UI

Open http://localhost:4000 to see:
- **Functions** tab — function invocation logs
- **Firestore** tab — live database state
- **Storage** tab — uploaded files
- **Auth** tab — anonymous user sessions

### 4.4 Test CSV Upload via CLI

In a **third terminal**:

```bash
# Upload the small test file
curl -X POST http://localhost:5001/project-prism-489108-a9e2b/us-central1/uploadCSV \
  -H "Content-Type: application/json" \
  -d "{\"csv\": \"$(cat test-data/sample-3-opportunities.csv | tr -d '\r' | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')\", \"filename\": \"test.csv\"}"
```

Expected response:
```json
{"success":true,"message":"CSV uploaded successfully","filename":"test.csv"}
```

### 4.5 Verify Processing in Emulator UI

1. Open http://localhost:4000 → **Functions** tab
2. Watch for `onCSVUpload` function invocation logs
3. Open **Firestore** tab → check for `/reports/{today}` document
4. Open **Storage** tab → check for `uploads/test.csv` file

> **Note:** The emulator won't actually call the Anthropic API. The `getLLMConfig()` function will throw "ANTHROPIC_API_KEY not set" unless you set it in the emulator environment. This is expected behaviour during local testing — the function will log the error and continue. To test with real LLM calls locally, ensure `functions/.env` has your API key.

### 4.6 Test HTTP Endpoints

```bash
# Test getReport
curl http://localhost:5001/project-prism-489108-a9e2b/us-central1/getReport

# Test getReportHistory
curl http://localhost:5001/project-prism-489108-a9e2b/us-central1/getReportHistory
```

### 4.7 Stop Emulators

Press `Ctrl+C` in the emulator terminal.

---

## Phase 5: Production Deployment

### 5.1 Pre-deploy Checklist

Before running any deploy command, verify:

- [ ] `.firebaserc` contains `project-prism-489108-a9e2b`
- [ ] `firebase use` shows the correct active project
- [ ] Both `npm run build` commands pass (functions + hosting)
- [ ] `hosting/.env` has all 6 real Firebase config values
- [ ] `ANTHROPIC_API_KEY` secret exists in Secret Manager
- [ ] All 6 function definitions have `secrets: ["ANTHROPIC_API_KEY"]`
- [ ] Firebase Auth Anonymous provider is enabled
- [ ] `project-prism-uploads` bucket exists
- [ ] Firebase Blaze plan is active

### 5.2 Deploy in Stages (Recommended for First Deploy)

Deploy services one at a time so you can identify issues quickly.

**Step 1: Deploy Firestore rules**
```bash
firebase deploy --only firestore:rules
```

**Step 2: Deploy Storage rules**
```bash
firebase deploy --only storage
```

**Step 3: Deploy Cloud Functions**
```bash
firebase deploy --only functions
```

This step takes 5–10 minutes. Watch for any errors. Expected output:
```
✔  functions[onCSVUpload(us-central1)]: Successful create operation.
✔  functions[runWeeklyAnalysis(us-central1)]: Successful create operation.
✔  functions[getReport(us-central1)]: Successful create operation.
✔  functions[getReportHistory(us-central1)]: Successful create operation.
✔  functions[uploadCSV(us-central1)]: Successful create operation.
✔  functions[fetchFromBigQuery(us-central1)]: Successful create operation.
```

**Step 4: Immediately check function logs**
```bash
firebase functions:log --limit 50
```

Look for any errors. A clean deploy shows only startup messages.

**Step 5: Deploy Hosting**
```bash
firebase deploy --only hosting
```

Expected:
```
✔  hosting[project-prism-489108-a9e2b]: 1 files uploaded successfully
Hosting URL: https://project-prism-489108-a9e2b.web.app
```

### 5.3 Full Deploy Command (Future Deployments)

Once everything is working, use the single command:

```bash
firebase deploy
```

This runs the following in order:
1. Pre-deploy hook: `npm --prefix functions run build`
2. Pre-deploy hook: `npm --prefix hosting run build`
3. Deploys all 6 Cloud Functions
4. Deploys Firebase Hosting (uploads `hosting/dist/`)
5. Deploys Firestore rules
6. Deploys Storage rules

### 5.4 Deploy Individual Services (for Updates)

```bash
firebase deploy --only functions              # All functions
firebase deploy --only functions:getReport    # Single function
firebase deploy --only hosting                # Frontend only
firebase deploy --only firestore:rules        # Rules only
firebase deploy --only storage                # Storage rules only
```

---

## Phase 6: Verification & Testing

### 6.1 Open the Live Dashboard

```
https://project-prism-489108-a9e2b.web.app
```

The dashboard should load. The browser console should show:
```
Signed in anonymously
```

With no data uploaded yet, the dashboard will show empty/placeholder state — this is correct.

### 6.2 Test API Endpoints

```bash
# Get latest report (expect 404 if no data yet — that's correct)
curl -s https://project-prism-489108-a9e2b.web.app/api/report | python3 -m json.tool

# Get report history
curl -s https://project-prism-489108-a9e2b.web.app/api/report/history | python3 -m json.tool
```

### 6.3 Upload a Test CSV

```bash
# Upload the small 3-record test file
curl -X POST https://project-prism-489108-a9e2b.web.app/api/upload \
  -H "Content-Type: application/json" \
  -d "{\"csv\": \"$(cat test-data/sample-3-opportunities.csv | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')\", \"filename\": \"test-upload.csv\"}"
```

Expected response:
```json
{"success":true,"message":"CSV uploaded successfully","filename":"test-upload.csv"}
```

### 6.4 Monitor Processing

The `onCSVUpload` function triggers automatically when the CSV lands in Cloud Storage. Processing takes 1–5 minutes for 3 records.

**Watch logs in real time:**
```bash
firebase functions:log --only onCSVUpload
```

**Or in the Firebase Console:**
1. Go to https://console.firebase.google.com/project/project-prism-489108-a9e2b/functions
2. Click on `onCSVUpload` → **Logs** tab

Look for:
```
Parsed N records from CSV
Running validation...
Initializing analyzer...
Running LLM analysis...
Analysis complete: N successful analyses
Report stored: report_xxxxx
```

### 6.5 Verify Firestore Data

1. Go to [Firestore Console](https://console.firebase.google.com/project/project-prism-489108-a9e2b/firestore)
2. Check for:
   - `/reports/{today}` — aggregated report document
   - `/analyses/{executionId}/opportunities/` — individual LLM analyses
   - `/executions/{executionId}` — pipeline run metadata with `status: "completed"`

### 6.6 Verify Storage Bucket

1. Go to https://console.cloud.google.com/storage/browser/project-prism-uploads
2. Check `uploads/` folder contains `test-upload.csv`

### 6.7 Verify the Report Appears in the Dashboard

After processing completes, refresh https://project-prism-489108-a9e2b.web.app — the dashboard should now display data from the uploaded CSV.

### 6.8 Verify the Weekly Scheduler Job

1. Go to https://console.cloud.google.com/cloudscheduler?project=project-prism-489108-a9e2b
2. You should see `firebase-schedule-runWeeklyAnalysis-us-central1` listed
3. It runs every Monday at 6:00 AM UTC automatically

**To trigger the weekly job manually for testing:**
```bash
gcloud scheduler jobs run firebase-schedule-runWeeklyAnalysis-us-central1 \
  --location=us-central1 \
  --project=project-prism-489108-a9e2b
```

### 6.9 Test the BigQuery Endpoint (if configured)

```bash
curl -X POST https://project-prism-489108-a9e2b.web.app/api/bigquery \
  -H "Content-Type: application/json" \
  -d '{"sinceDate": "2026-01-01"}'
```

---

## Phase 7: Operations

### 7.1 CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml` at the project root to automatically deploy on every push to `main`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main
  workflow_dispatch:   # Allow manual triggers

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install root dependencies
        run: npm install

      - name: Install functions dependencies
        run: npm install
        working-directory: functions

      - name: Install hosting dependencies
        run: npm install
        working-directory: hosting

      - name: Build functions
        run: npm run build
        working-directory: functions

      - name: Build hosting
        run: npm run build
        working-directory: hosting
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: project-prism-489108-a9e2b
          channelId: live
```

**Set up GitHub Secrets:**

1. Generate a Firebase service account key:
   ```bash
   gcloud iam service-accounts keys create firebase-service-account.json \
     --iam-account=github-actions@project-prism-489108-a9e2b.iam.gserviceaccount.com
   ```

   Or use the Firebase GitHub Actions setup:
   ```bash
   firebase init hosting:github
   ```
   This automatically creates the service account and adds it to your GitHub repo secrets.

2. Add all `VITE_FIREBASE_*` values as GitHub repository secrets at:
   `https://github.com/bptowers/project-prism/settings/secrets/actions`

### 7.2 Monitoring — Set Up Error Alerts

**Create an alert for function errors:**

1. Go to https://console.cloud.google.com/monitoring/alerting
2. Click **Create policy**
3. **Metric:** Cloud Functions → User-defined function → `execution_count`
4. **Filter:** `status = error`
5. **Condition:** Count > 0
6. **Notification channel:** Add your email
7. **Alert name:** `Project Prism — Function Errors`

**Or via gcloud:**
```bash
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="Project Prism Function Errors" \
  --condition-display-name="Function error count > 0" \
  --project=project-prism-489108-a9e2b
```

**View function metrics:**
```
https://console.cloud.google.com/functions/list?project=project-prism-489108-a9e2b
```

### 7.3 Budget Alerts

Prevent unexpected costs:

1. Go to https://console.cloud.google.com/billing
2. Select your billing account
3. Click **Budgets & alerts** → **Create budget**
4. Scope: Project `project-prism-489108-a9e2b`
5. Budget amount: `$25/month`
6. Alert thresholds: 50%, 90%, 100%
7. Email notifications: your email
8. Click **Save**

### 7.4 Viewing Logs

**Firebase CLI:**
```bash
# All functions, last 50 lines
firebase functions:log --limit 50

# Specific function
firebase functions:log --only onCSVUpload

# Follow in real time
firebase functions:log --only onCSVUpload --limit 100
```

**Cloud Console:**
```
https://console.cloud.google.com/functions/list?project=project-prism-489108-a9e2b
```
Click any function → **Logs** tab.

**Cloud Logging (advanced filtering):**
```
https://console.cloud.google.com/logs/query?project=project-prism-489108-a9e2b
```
Example filter:
```
resource.type="cloud_run_revision"
severity=ERROR
```

### 7.5 Rollback a Deployment

**Roll back Cloud Functions to the previous version:**

1. Find the previous deployment:
   ```bash
   gcloud functions list --project=project-prism-489108-a9e2b
   ```

2. Redeploy from a specific git commit:
   ```bash
   git log --oneline -5   # Find the commit hash
   git checkout <commit-hash>
   cd functions && npm install && npm run build
   firebase deploy --only functions
   git checkout main
   ```

**Roll back Firebase Hosting:**
1. Go to [Firebase Console → Hosting](https://console.firebase.google.com/project/project-prism-489108-a9e2b/hosting)
2. Click the **Release History** tab
3. Find the previous release → click **⋮** → **Rollback**

### 7.6 Firebase Hosting Preview Channels (Staging)

Test frontend changes before pushing to production:

```bash
# Deploy to a preview channel (creates a temporary URL)
firebase hosting:channel:deploy staging --expires 7d

# Output: Preview URL: https://project-prism-489108-a9e2b--staging-XXXXX.web.app
```

Preview channels expire automatically. Good for testing with stakeholders before merging to main.

### 7.7 Rotating the Anthropic API Key

When your Anthropic API key needs to be rotated:

```bash
# 1. Add the new key as a new secret version
echo -n "sk-ant-new-key-here" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-

# 2. Verify the new version is active
gcloud secrets versions list ANTHROPIC_API_KEY

# 3. Redeploy functions to pick up the new version
firebase deploy --only functions

# 4. Verify functions are working, then disable the old version
gcloud secrets versions disable OLD_VERSION_NUMBER --secret=ANTHROPIC_API_KEY
```

### 7.8 Custom Domain (Optional)

To use a custom domain (e.g., `prism.yourcompany.com`) instead of the default `.web.app` URL:

1. Go to [Firebase Console → Hosting](https://console.firebase.google.com/project/project-prism-489108-a9e2b/hosting)
2. Click **Add custom domain**
3. Enter your domain
4. Firebase provides DNS records to add to your domain registrar
5. Add the TXT record, wait for verification (up to 24 hours)
6. Add the A records provided by Firebase
7. Firebase automatically provisions an SSL certificate

---

## Appendix A: Troubleshooting

### "ANTHROPIC_API_KEY or LLM_API_KEY not set"

**Symptom:** Function logs show `Error: LLM_API_KEY or ANTHROPIC_API_KEY environment variable not set`

**Causes and fixes:**

1. **Secret doesn't exist:** Check with `gcloud secrets list`. If missing, create it (Phase 2.6).

2. **Function missing `secrets` option:** Every function that calls `getLLMConfig()` must have `secrets: ["ANTHROPIC_API_KEY"]` in its options object (Phase 3.1).

3. **Service account lacks access:** Re-run the IAM binding command from Phase 2.6.

4. **Redeploy required:** After adding the `secrets` option, you must redeploy: `firebase deploy --only functions`

### "403 Permission Denied" on CSV Upload

**Symptom:** Upload returns HTTP 403 or storage error

**Cause:** Firebase Auth is not set up or the anonymous sign-in is not working.

**Fix:**
1. Verify Anonymous Authentication is enabled in Firebase Console (Phase 2.3)
2. Verify `hosting/src/lib/firebase.ts` includes the `signInAnonymously` call (Phase 3.2)
3. Check browser console for `Signed in anonymously` message
4. Check `storage.rules` — the `uploads/` path requires `request.auth != null`

### "Bucket not found" for `project-prism-uploads`

**Symptom:** `onCSVUpload` or `uploadCSV` logs show storage bucket error

**Fix:**
1. Verify the bucket exists: `gcloud storage buckets list --project=project-prism-489108-a9e2b`
2. Bucket name must be exactly `project-prism-uploads` (no spaces, exact casing)
3. Bucket must be in the same GCP project as the functions

### Functions Deploy Fails

**"Billing account not configured":**
Upgrade to Blaze plan at https://console.firebase.google.com/project/project-prism-489108-a9e2b/usage

**"API not enabled":**
Re-run the `gcloud services enable` commands from Phase 2.1

**"Permission denied" during deploy:**
```bash
gcloud auth application-default login
firebase login --reauth
```

**"Failed to create secret version":**
The Secret Manager API may not be enabled:
```bash
gcloud services enable secretmanager.googleapis.com
```

### Hosting Shows Blank Page / 404

1. Verify `hosting/dist/` exists and contains `index.html`:
   ```bash
   ls hosting/dist/
   ```
2. If not, run `cd hosting && npm run build`
3. Check `firebase.json` — `"public": "hosting/dist"` must be correct
4. The SPA fallback rewrite `{ "source": "**", "destination": "/index.html" }` must be last in the rewrites array

### CORS Errors in Browser Console

CORS errors almost always mask a different underlying error. Check:
1. The actual HTTP response status in Network tab (look for 500)
2. Cloud Functions logs for the root error
3. CORS is not configured explicitly in the current code — Firebase handles it automatically for `onRequest` functions

### TypeScript Compilation Errors

Common causes:
- `noUnusedLocals: true` in `functions/tsconfig.json` — remove unused imports
- Module resolution: ensure imports use `.js` extension (e.g., `import { X } from "./types.js"`)
- After adding `secrets` option: the option type is `string[]`, e.g., `secrets: ["ANTHROPIC_API_KEY"]`

### Weekly Scheduler Not Firing

1. Check Cloud Scheduler in the console
2. Verify PubSub API is enabled
3. Check the function was deployed: `gcloud functions list`
4. Manual trigger: `gcloud scheduler jobs run firebase-schedule-runWeeklyAnalysis-us-central1 --location=us-central1`

### BigQuery "Access Denied"

The Cloud Functions service account needs BigQuery reader access on the dataset. See Phase 2.7 for the IAM command.

---

## Appendix B: Cost Reference

### Firebase Free Tier Limits (Blaze plan — free usage before charges)

| Service | Free per month |
|---|---|
| Cloud Functions invocations | 2,000,000 |
| Cloud Functions compute time | 400,000 GB-seconds |
| Firestore reads | 50,000/day |
| Firestore writes | 20,000/day |
| Cloud Storage | 5 GB storage, 1 GB/day download |

### Estimated Monthly Cost for 1,000 Opportunity Records

| Service | Estimated Cost |
|---|---|
| Cloud Functions (execution + compute) | $1–$2 |
| Firestore (reads/writes/storage) | < $1 |
| Cloud Storage (CSV uploads) | < $1 |
| Secret Manager | < $0.10 |
| **LLM API (Claude Sonnet)** | ~$1.50 |
| **LLM API (Gemini Flash)** | ~$0.08 |
| **LLM API (OpenAI GPT-4o)** | ~$5–$15 |
| **Total (with Claude)** | **~$4–$5/month** |

### LLM Provider Comparison

| Provider | Model | Cost per 1K records | Quality | Speed |
|---|---|---|---|---|
| **Claude (recommended)** | claude-sonnet-4-5-20250929 | ~$1.50 | Highest | Fast |
| Gemini | gemini-1.5-flash | ~$0.08 | Good | Fastest |
| OpenAI | gpt-4o | ~$10–$15 | High | Medium |

### Cost Monitoring

Monitor costs at: https://console.cloud.google.com/billing/linkedaccount?project=project-prism-489108-a9e2b

Set up a budget alert at $25/month (Phase 7.3) to avoid surprises.

---

## Appendix C: Quick Reference Card

### All URLs After Deployment

| Resource | URL |
|---|---|
| Dashboard | https://project-prism-489108-a9e2b.web.app |
| Get latest report | https://project-prism-489108-a9e2b.web.app/api/report |
| Get report history | https://project-prism-489108-a9e2b.web.app/api/report/history |
| Upload CSV (POST) | https://project-prism-489108-a9e2b.web.app/api/upload |
| BigQuery fetch (POST) | https://project-prism-489108-a9e2b.web.app/api/bigquery |
| Firebase Console | https://console.firebase.google.com/project/project-prism-489108-a9e2b |
| Firestore | https://console.firebase.google.com/project/project-prism-489108-a9e2b/firestore |
| Functions | https://console.firebase.google.com/project/project-prism-489108-a9e2b/functions |
| Hosting | https://console.firebase.google.com/project/project-prism-489108-a9e2b/hosting |
| Auth | https://console.firebase.google.com/project/project-prism-489108-a9e2b/authentication |
| Cloud Storage | https://console.cloud.google.com/storage/browser?project=project-prism-489108-a9e2b |
| Cloud Scheduler | https://console.cloud.google.com/cloudscheduler?project=project-prism-489108-a9e2b |
| Cloud Logs | https://console.cloud.google.com/logs/query?project=project-prism-489108-a9e2b |
| Billing | https://console.cloud.google.com/billing/linkedaccount?project=project-prism-489108-a9e2b |

### CLI Commands Cheat Sheet

```bash
# Set active project
firebase use project-prism-489108-a9e2b

# Deploy everything
firebase deploy

# Deploy specific service
firebase deploy --only functions
firebase deploy --only functions:uploadCSV
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only storage

# View function logs
firebase functions:log
firebase functions:log --only onCSVUpload
firebase functions:log --limit 100

# Preview staging channel
firebase hosting:channel:deploy staging --expires 7d

# Manage secrets
gcloud secrets list
gcloud secrets versions list ANTHROPIC_API_KEY
echo -n "new-key" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-

# Test endpoints
curl https://project-prism-489108-a9e2b.web.app/api/report
curl https://project-prism-489108-a9e2b.web.app/api/report/history

# Trigger weekly job manually
gcloud scheduler jobs run firebase-schedule-runWeeklyAnalysis-us-central1 \
  --location=us-central1 --project=project-prism-489108-a9e2b
```

### Environment Variables Reference

**`functions/.env`** (local dev only, gitignored)
```
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000
BQ_PROJECT_ID=
BQ_DATASET=
BQ_TABLE=
BQ_LOCATION=US
```

**`functions/.env.production`** (deployed with functions, gitignored)
```
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000
BQ_LOCATION=US
```

**`hosting/.env`** (local only, gitignored)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Complete Deployment Checklist

**Prerequisites**
- [ ] Node.js v20 installed
- [ ] Firebase CLI installed and logged in (`firebase login`)
- [ ] gcloud CLI installed and authenticated (`gcloud auth application-default login`)
- [ ] Firebase project on Blaze (pay-as-you-go) plan
- [ ] Anthropic API key ready

**Phase 1: Local Config**
- [ ] `.firebaserc` updated to `project-prism-489108-a9e2b`
- [ ] `firebase use project-prism-489108-a9e2b` confirms active project
- [ ] `npm install` run in root, `functions/`, and `hosting/`
- [ ] `functions/.env` created with API key
- [ ] `functions/.env.production` created with non-secret config
- [ ] `hosting/.env` created (placeholder values OK for now)
- [ ] Both TypeScript builds pass (`npm run build`)

**Phase 2: Console Setup**
- [ ] All GCP APIs enabled
- [ ] Firestore database created (note region used)
- [ ] Firestore rules deployed
- [ ] Firebase Authentication — Anonymous provider enabled
- [ ] `project-prism-uploads` bucket created (same region as Firestore)
- [ ] Storage rules deployed
- [ ] Firebase Web App registered — SDK config copied
- [ ] `hosting/.env` updated with real Firebase config values
- [ ] `ANTHROPIC_API_KEY` stored in Secret Manager
- [ ] Cloud Functions service account granted Secret Manager access
- [ ] (Optional) BigQuery IAM access configured

**Phase 3: Code Changes**
- [ ] All 6 functions have `secrets: ["ANTHROPIC_API_KEY"]` in their options
- [ ] `hosting/src/lib/firebase.ts` updated with anonymous auth + auth emulator
- [ ] Both builds still pass after code changes

**Phase 4: Emulator Testing**
- [ ] Emulators start without errors
- [ ] Dashboard loads with `Signed in anonymously` in console
- [ ] CSV upload test returns success
- [ ] `onCSVUpload` function triggered in emulator logs
- [ ] Firestore document created in emulator

**Phase 5: Production Deploy**
- [ ] All 6 functions deployed successfully
- [ ] Function logs show no errors immediately after deploy
- [ ] Hosting deployed — live URL accessible
- [ ] Both rules deployed

**Phase 6: Verification**
- [ ] Dashboard loads at `https://project-prism-489108-a9e2b.web.app`
- [ ] `/api/report` endpoint responds (404 is OK if no data yet)
- [ ] `/api/upload` test returns success
- [ ] `onCSVUpload` triggered and completed in Cloud Logs
- [ ] Firestore document visible in console
- [ ] File visible in `project-prism-uploads` bucket
- [ ] Cloud Scheduler job `runWeeklyAnalysis` registered

**Phase 7: Operations**
- [ ] Budget alert set at $25/month
- [ ] Error monitoring alert configured
- [ ] GitHub Actions workflow deployed (CI/CD)
