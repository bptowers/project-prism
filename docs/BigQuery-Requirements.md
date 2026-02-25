# BigQuery Integration Requirements

**For:** Data Warehouse / SFDC Team
**From:** Brad Towers, SE Lead UK/ANZ
**Date:** February 2026
**Reference:** Prism-Data-Requirements-Spec.docx (full field specification)

---

## What We Need From You

### 1. BigQuery Connection Details

| Item | Description | Example |
|------|-------------|---------|
| **GCP Project ID** | The Google Cloud project where the BigQuery dataset lives | `my-data-warehouse-123` |
| **Dataset Name** | The BigQuery dataset containing opportunity data | `salesforce_data` |
| **Table Name** | The table or view with opportunity records | `opportunities` |
| **Location** | BigQuery dataset region | `US` or `australia-southeast1` |

### 2. IAM Access Grant

Prism's Cloud Function needs read access to your BigQuery dataset. Please grant the following role:

- **Role:** `roles/bigquery.dataViewer`
- **Principal:** `project-prism-69395@appspot.gserviceaccount.com`
- **Scope:** The dataset containing opportunity data

This grants read-only access — Prism will never write to your BigQuery tables.

**How to grant (BigQuery Console):**
1. Open your BigQuery dataset in the Google Cloud Console
2. Click **Sharing** > **Permissions**
3. Click **Add Principal**
4. Enter: `project-prism-69395@appspot.gserviceaccount.com`
5. Assign role: **BigQuery Data Viewer**
6. Save

### 3. Column Name Confirmation

Prism expects **Salesforce API field names** as column headers. Please confirm whether your BigQuery table uses these names or something different. The critical columns are:

#### Required (pipeline fails without these)

| Expected Column Name | Type | Purpose |
|---------------------|------|---------|
| `Id` | STRING | Salesforce Opportunity ID |
| `Name` | STRING | Opportunity name |
| `Account_Name` or `Account.Name` | STRING | Customer account name |
| `StageName` | STRING | Current sales stage |
| `Expected_MRR__c` | NUMERIC | Monthly Recurring Revenue (primary revenue metric) |
| `CloseDate` | DATE | Expected or actual close date |
| `CreatedDate` | DATETIME | When the opportunity was created |
| `LastModifiedDate` | DATETIME | Last update timestamp |

#### Recommended (significantly improves analysis quality)

| Expected Column Name | Type | Purpose |
|---------------------|------|---------|
| `Amount` | NUMERIC | Total deal value (fallback if MRR unavailable) |
| `IsClosed` | BOOLEAN | Whether opportunity is closed |
| `IsWon` | BOOLEAN | Whether opportunity was won |
| `CurrencyIsoCode` | STRING | ISO currency code (AUD, GBP, USD) — used for region detection |
| `Owner_Name` or `Owner.Name` | STRING | Sales rep / opportunity owner |
| `LastActivityDate` | DATE | Last logged activity date |
| `Territory_Region__c` | STRING | Region assignment (APAC, EMEA, NAMER) |
| `Description` | STRING | Opportunity description |
| `Why_They_Bought__c` | STRING | Win narrative — primary AI analysis input |
| `Lost_Reason__c` | STRING | Structured loss reason |
| `Lost_Reason_Details__c` | STRING | Free-text loss context |
| `Deal_Takeaways__c` | STRING | Key deal learnings |
| `Main_Competitor__c` | STRING | Primary competitor on the deal |
| `Economic_Buyer__c` | STRING | Economic buyer name/title |
| `Close_Plan__c` | STRING | Documented close strategy |
| `Missing_Features__c` | STRING | Features requested but unavailable |

#### Optional (enhances intelligence output)

| Expected Column Name | Type | Purpose |
|---------------------|------|---------|
| `NextStep` | STRING | Documented next action |
| `Probability` | NUMERIC | Win probability (0-100) |
| `ForecastCategoryName` | STRING | Forecast category |
| `LeadSource` | STRING | Lead origin |
| `Type` | STRING | New Business, Expansion, Renewal |
| `BillingState` | STRING | Account billing state |
| `BillingCountry` | STRING | Account billing country |
| `Reason_for_Win__c` | STRING | Structured win reason |
| `Win_Notes__c` | STRING | Additional win context |
| `Win_Story__c` | STRING | Detailed win narrative |
| `Path_to_Purchase__c` | STRING | Buyer journey details |
| `Manager_Notes__c` | STRING | Manager observations |
| `Price_Reason__c` | STRING | Price factor details |
| `simPRO_Company__c` | STRING | Product line / entity |

> **If your columns use different names**, just let us know — Prism's parser supports configurable column mapping and we can update it in minutes.

---

## Data Scope

The BigQuery extract should include:

- **Time Range:** All opportunities created or closed in the last **12 months**, plus all currently active/in-flight deals regardless of creation date
- **Stages:** All stages — Discovery, Validation, Solution Review & Quote, Commitment, Contract Review, Closed Won, Closed Lost. **Do not filter out closed or lost deals** — loss analysis is as valuable as win analysis
- **Regions:** All regions (UK, AU, NZ, NA, IE)
- **Record Types:** Standard Opportunities only (exclude Renewal-only records unless they have sales involvement)
- **Expected Volume:** ~500–1,500 rows per extract. Prism processes in batches of 25 with concurrency; 1,000 rows takes ~5–10 minutes

---

## Refresh Cadence

- **Minimum:** Weekly (Mondays, before the pipeline call)
- **Ideal:** Daily — given Simpro's 14-day sales cycle, stale data degrades analysis quality quickly
- **Mechanism:** Prism has a Cloud Function (`POST /api/bigquery`) that queries BigQuery directly on demand. No file export needed — we pull the data via the BigQuery API.

---

## How Prism Connects

Prism uses a Firebase Cloud Function with the `@google-cloud/bigquery` Node.js client library. The connection flow:

```
Prism Cloud Function → BigQuery API (cross-project) → Your Dataset → Return Rows
       ↓
Parse & Map to OpportunityRecord[]
       ↓
Validate → LLM Analysis → Aggregate → Dashboard
```

- **Authentication:** Application Default Credentials (ADC) — no API keys or service account key files exchanged. The IAM grant (Step 2 above) is the only access configuration needed.
- **Query:** `SELECT * FROM your-project.dataset.table ORDER BY LastModifiedDate DESC`
- **Incremental pulls supported:** Optional date filter to fetch only recently modified records

---

## Quick Checklist

- [ ] Provide GCP Project ID
- [ ] Provide Dataset name and Table name
- [ ] Confirm column names match Salesforce API names (or provide mapping)
- [ ] Grant `bigquery.dataViewer` to `project-prism-69395@appspot.gserviceaccount.com`
- [ ] Confirm data includes 12 months of history + active pipeline
- [ ] Confirm closed/lost deals are included (not filtered out)

---

## Questions?

Contact Brad Towers — brad.towers@simprogroup.com

We can also schedule a 30-minute walkthrough of how Prism consumes and analyses each field. See the full field specification in `Prism-Data-Requirements-Spec.docx` for detailed per-field documentation including priority levels and usage descriptions.
