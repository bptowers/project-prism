# Project Prism — BigQuery Integration Guide

> Step-by-step setup for connecting Project Prism to live Salesforce data via BigQuery.
>
> **Date:** 10 March 2026 | **Author:** Brad Towers / Claude

---

## Overview

This guide walks you through connecting Project Prism to a BigQuery data source that already contains Salesforce opportunity data. When done, you can trigger a BigQuery pull from the command line, and the data flows through the same LLM analysis pipeline that works with CSV uploads.

### What Is Already Built (No Code Changes Needed)

- `fetchFromBigQuery` Cloud Function — fully implemented in `functions/src/index.ts` (lines 459–567)
- `BigQuerySource` class — fully implemented in `functions/src/pipeline/bigquerySource.ts` (445 lines)
- `@google-cloud/bigquery` npm dependency — already in `functions/package.json`
- `/api/bigquery` rewrite — already configured in `firebase.json`
- Uses the same `runAnalysisPipeline()` as CSV uploads (parallel batches, same LLM analysis)

### What You Need to Do

1. Get 3 values from Babatunde: GCP project ID, dataset name, table name
2. Add those values to `functions/.env`
3. Ask Babatunde to run one IAM command on his GCP project
4. Rebuild and redeploy the Cloud Functions
5. Test the connection

---

## Step 0: Prerequisites

### Firebase CLI
```bash
firebase --version    # Should show 13.x.x
firebase login        # If not logged in
```
If missing: `npm install -g firebase-tools`

### Google Cloud CLI (gcloud)
```bash
gcloud --version      # Should show a version
gcloud init           # Select project: project-prism-489108-a9e2b
```
If missing: install from https://cloud.google.com/sdk/docs/install

### Node.js
```bash
node --version        # Need v20 or later
```

### Pipeline Health
Verify the CSV pipeline is still working before adding BigQuery. Last known good: revision `oncsvupload-00015-hih`.

---

## Step 1: Get Three Values from Babatunde

You need exactly three pieces of information from the data team:

| Value | What It Is | Example |
|-------|-----------|---------|
| **GCP Project ID** | The Google Cloud project where Salesforce data sits in BigQuery. **NOT** your Firebase project ID. | `simpro-data-warehouse-prod` |
| **Dataset Name** | The BigQuery dataset (like a folder) containing the Salesforce opportunity table. | `salesforce_raw` |
| **Table Name** | The specific table with opportunity records. | `opportunities` |

**These are case-sensitive.** Write them down exactly as Babatunde gives them.

### Column Names

The code handles column name variations automatically. `bigquerySource.ts` tries multiple names for each field (e.g., `Account_Name`, `Account.Name`, `AccountName`). If Babatunde says column names are non-standard, note them — we can adjust the field mapping later.

---

## Step 2: Add Values to functions/.env

### Open the file
```bash
cd /path/to/your/project-prism/functions
open -e .env    # Opens in TextEdit (or use any text editor)
```

### Add these lines at the end
```env
# BigQuery Data Source (values from data team)
BQ_PROJECT_ID=<replace-with-babatundes-project-id>
BQ_DATASET=<replace-with-babatundes-dataset-name>
BQ_TABLE=<replace-with-babatundes-table-name>
BQ_LOCATION=US
```

### Complete file example
```env
# Copy this to .env and fill in your API key
LLM_API_KEY=ssk-ant-api03-dp4w8E...
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-6
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=10000

# BigQuery Data Source (values from data team)
BQ_PROJECT_ID=simpro-data-warehouse-prod
BQ_DATASET=salesforce_raw
BQ_TABLE=opportunities
BQ_LOCATION=US
```

Save and close. **Do NOT commit this file to git** (it contains your API key).

### About BQ_LOCATION
Default is `US`. If Babatunde says the data is in a different region (e.g., `australia-southeast1` or `EU`), change it to match. If he doesn't mention it, leave it as `US`.

---

## Step 3: Ask Babatunde to Grant IAM Access

Your Cloud Functions run as this service account:
```
project-prism-489108-a9e2b@appspot.gserviceaccount.com
```

### What Babatunde needs to run

One command, replacing `<his-project-id>` with the GCP Project ID from Step 1:

```bash
gcloud projects add-iam-policy-binding <his-project-id> \
  --member="serviceAccount:project-prism-489108-a9e2b@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"
```

### What this does
- `roles/bigquery.dataViewer` is **read-only** — can query tables, cannot modify/delete anything
- Grants access to all datasets in that project (can be scoped to a single dataset if needed)
- Standard IAM grant, can be revoked at any time

### Alternative: Google Cloud Console UI
1. Go to `console.cloud.google.com`, select his project
2. IAM & Admin → IAM → click **+ GRANT ACCESS**
3. New principals: `project-prism-489108-a9e2b@appspot.gserviceaccount.com`
4. Role: search for **BigQuery Data Viewer**, select it
5. Click **Save**

### Verify access was granted
```bash
gcloud projects get-iam-policy <his-project-id> \
  --flatten="bindings[].members" \
  --filter="bindings.members:project-prism-489108-a9e2b@appspot.gserviceaccount.com"
```
Should show `roles/bigquery.dataViewer`.

---

## Step 4: Build and Deploy

```bash
cd /path/to/your/project-prism
cd functions && npm run build    # Compile TypeScript → no errors expected
cd .. && firebase deploy --only functions   # Deploy (1-2 minutes)
```

**Why this is required:** The `.env` values are baked into the Cloud Run container at deploy time. If you change `.env` without redeploying, the deployed functions will still use the old values.

---

## Step 5: Test the BigQuery Connection

### 5.1 — Get an auth token
```bash
gcloud auth print-identity-token
```
Copies a long JWT string. **Expires in ~1 hour** — regenerate if needed.

### 5.2 — Full pull (all records)
```bash
curl -X POST https://project-prism-489108-a9e2b.web.app/api/bigquery \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 5.3 — Success response
```json
{
  "success": true,
  "reportId": "report_1773200000000",
  "recordCount": 150,
  "reportDate": "2026-03-10"
}
```

### 5.4 — After success
- Open the Project Prism dashboard
- Dashboard picks up new data automatically (real-time Firestore listener)
- Data source switches from "sample data" to live
- Full pipeline (including Phase 2 enrichment) takes 7–10 minutes for large datasets
- Dashboard updates twice: once for base report, again when enrichment completes

### 5.5 — Incremental pull (date filter)
```bash
curl -X POST https://project-prism-489108-a9e2b.web.app/api/bigquery \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sinceDate": "2026-03-01"}'
```
`sinceDate` must be `YYYY-MM-DD`. Adds `WHERE LastModifiedDate >= @sinceDate` to the query.

---

## Troubleshooting

### How to read the logs
Go to `console.cloud.google.com/logs`, select `project-prism-489108-a9e2b`, filter by:
```
resource.type="cloud_run_revision"
```
Look for `[exec_...]` prefixed lines.

### Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `BigQuery configuration missing` | BQ_ env vars not set or not deployed | Check `functions/.env`, rebuild and redeploy (Step 4) |
| `403 Access Denied` from BigQuery | IAM grant missing | Confirm Babatunde ran the command from Step 3 |
| `404 Not found: Table` | Wrong project/dataset/table name | Ask Babatunde to double-check the identifiers |
| `401 Unauthorized` on HTTP request | Auth token expired or invalid | Run `gcloud auth print-identity-token` for a fresh token |
| `401` from Claude API during analysis | ANTHROPIC_API_KEY invalid | Run `firebase functions:secrets:access ANTHROPIC_API_KEY` to check |
| `DEADLINE_EXCEEDED` | Too many records for the timeout | Use `sinceDate` to pull fewer records |
| curl returns nothing (hangs) | Function still running | Wait 7–15 min for large datasets; check logs if >20 min |
| Records show `region = "Unknown"` | No geographic columns in the data | Ask Babatunde which columns have region/country info |

---

## Field Mapping Reference

`bigquerySource.ts` tries multiple column names for each field. Key mappings:

| Internal Field | BigQuery Columns Tried |
|---------------|----------------------|
| `opportunityId` | Id, Opportunity_ID, OpportunityId |
| `accountName` | Account_Name, Account.Name, AccountName |
| `opportunityName` | Name, Opportunity_Name, OpportunityName |
| `stage` | StageName, Stage, Stage_Name |
| `expectedMRR` | Expected_MRR__c, Expected_MRR, ExpectedMRR |
| `amount` | Amount |
| `closedDate` | CloseDate, Close_Date |
| `salesRep` | Owner_Name, Owner.Name, Opportunity_Owner |
| `probability` | Probability |
| `industry` | Industry |
| `currency` | CurrencyIsoCode, Currency |
| `billingCountry` | BillingCountry, Billing_Country |
| `territoryRegion` | Territory_Region__c, Territory_Region |
| `mainCompetitor` | Main_Competitor__c, Main_Competitor |
| `lostReason` | Lost_Reason__c, Lost_Reason |

If the data team's columns don't match, add the correct names to `DEFAULT_BQ_FIELD_MAP` in `bigquerySource.ts`.

---

## Step 6: Automated Scheduled Pulls (Already Wired Up)

Once you have confirmed the manual BigQuery pull works (Step 5), the automated schedule is already active. No additional setup is required.

### What Changed

The `runWeeklyAnalysis` Cloud Function in `index.ts` has been updated to pull directly from BigQuery instead of looking for the most recent CSV in Cloud Storage. It uses the same `BigQuerySource` class and `runAnalysisPipeline()` as the manual `fetchFromBigQuery` endpoint.

### Schedule

The function runs automatically **every 3 days at 6:00 AM UTC**.

The cron expression is `0 6 */3 * *`, configured via Google Cloud Scheduler (managed by Firebase). This means:
- Day 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31 of each month at 6:00 AM UTC
- No manual trigger needed — it just runs

### What Happens on Each Scheduled Run

1. Cloud Scheduler fires the `runWeeklyAnalysis` function
2. The function reads `BQ_PROJECT_ID`, `BQ_DATASET`, `BQ_TABLE`, `BQ_LOCATION` from env vars
3. `BigQuerySource.fetchRecords()` pulls all records from BigQuery (full pull, no date filter)
4. Records go through the same pipeline: validate → LLM analysis (parallel batches) → aggregate
5. Base report is stored to Firestore with `dataSource: "bigquery"`
6. Phase 2 LLM enrichment runs (executive briefing, recommendations) — non-fatal if it fails
7. Dashboard updates automatically via real-time Firestore listener

### Changing the Schedule

To change the frequency, edit the cron expression in `functions/src/index.ts` on the `runWeeklyAnalysis` line:

```typescript
export const runWeeklyAnalysis = onSchedule(
  { schedule: "0 6 */3 * *", timeZone: "UTC", secrets: ["ANTHROPIC_API_KEY"] },
```

Common alternatives:
| Frequency | Cron Expression |
|-----------|----------------|
| Every 3 days at 6am UTC (current) | `0 6 */3 * *` |
| Every Monday at 6am UTC | `0 6 * * 1` |
| Every weekday at 6am UTC | `0 6 * * 1-5` |
| Daily at 6am UTC | `0 6 * * *` |
| Twice a week (Mon + Thu) | `0 6 * * 1,4` |

After changing the cron expression, rebuild and redeploy:
```bash
cd functions && npm run build && cd .. && firebase deploy --only functions
```

### Adding a Date Filter (Incremental Pulls)

The scheduled function currently does a full pull (all records). If you want to change it to only pull records modified in the last N days, this would be a small code change in `index.ts` — add a `sinceDate` to the BigQuery config before calling `fetchRecords()`. Ask Claude for help with this if needed.

### Monitoring Scheduled Runs

Check whether scheduled runs are executing:

```bash
# View Cloud Scheduler jobs
gcloud scheduler jobs list --project=project-prism-489108-a9e2b

# Check recent execution logs
# Go to: console.cloud.google.com/logs
# Filter: resource.type="cloud_run_revision" "scheduled-bigquery"
```

The execution ID prefix `scheduled-bigquery` distinguishes automated runs from manual pulls (`bigquery-fetch`) and CSV uploads (`csv-upload`) in the logs.

### If a Scheduled Run Fails

Failed runs are logged with `status: "failed"` in the `executions` Firestore collection. The function will retry automatically on the next scheduled interval. Check Cloud Logging for the error details.

---

## Quick Reference

```bash
# Build and deploy
cd functions && npm run build && cd .. && firebase deploy --only functions

# Get auth token
gcloud auth print-identity-token

# Full BigQuery pull
curl -X POST https://project-prism-489108-a9e2b.web.app/api/bigquery \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Incremental pull
curl -X POST https://project-prism-489108-a9e2b.web.app/api/bigquery \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sinceDate": "2026-03-01"}'

# Check logs
# console.cloud.google.com/logs → resource.type="cloud_run_revision"
```

| Phase | Time |
|-------|------|
| BigQuery fetch | 10–30 seconds |
| LLM analysis (parallel) | 5–10 min for ~100 records |
| Report storage | < 30 seconds |
| Phase 2 enrichment | 1–2 minutes |
| **Total end-to-end** | **7–15 min for ~100 records** |

## Automated Schedule

| Setting | Value |
|---------|-------|
| Function | `runWeeklyAnalysis` |
| Schedule | Every 3 days at 6:00 AM UTC |
| Cron | `0 6 */3 * *` |
| Data source | BigQuery (full pull) |
| Execution ID prefix | `scheduled-bigquery` |
| Log filter | `resource.type="cloud_run_revision" "scheduled-bigquery"` |
