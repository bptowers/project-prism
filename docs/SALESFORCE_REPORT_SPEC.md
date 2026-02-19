# Salesforce Report Spec for Project Prism

Project Prism needs a Salesforce data extract to feed its LLM-powered revenue intelligence pipeline. This spec defines the exact fields to include in a Salesforce Report export (CSV), organized by priority tier.

The CSV parser (`functions/src/pipeline/csvParser.ts`) handles multiple column name formats automatically — Salesforce Report labels, Data Loader API names, and Simpro's custom column names all work.

---

## Tier 1: Required Fields

These 6 fields are the absolute minimum. The LLM can produce a basic analysis from just these.

| # | Salesforce Report Column | SF API Name | Type | Internal Field | Why the LLM Needs It |
|---|---|---|---|---|---|
| 1 | **Opportunity ID** | `Id` | Text | `opportunityId` | Unique identifier for tracking and drill-down |
| 2 | **Account Name** | `Account.Name` | Text | `accountName` | Company identification, pattern matching across deals |
| 3 | **Opportunity Name** | `Name` | Text | `opportunityName` | Deal identification and context |
| 4 | **Stage** | `StageName` | Picklist | `stage` | Funnel position, stage-appropriateness assessment, risk scoring |
| 5 | **Close Date** | `CloseDate` | Date | `closedDate` | Stage compression detection, timeline risk |
| 6 | **Amount** | `Amount` | Currency | `amount` | Revenue-weighted risk, funnel revenue, forecast confidence |

**Win/Loss Status** is derived automatically from Stage name ("Closed Won" / "Closed Lost"), the `Category` column, or `Closed`/`Won` boolean columns — no explicit win/loss column required.

---

## Tier 2: Core Intelligence Fields

These fields unlock the LLM's risk signals, pattern detection, and actionable recommendations.

### Deal Context

| # | Salesforce Report Column | SF API Name | Type | Internal Field | Why the LLM Needs It |
|---|---|---|---|---|---|
| 7 | **Opportunity Owner** | `Owner.Name` | Text | `salesRep` | Rep performance patterns, coaching signals |
| 8 | **Created Date** | `CreatedDate` | DateTime | `createdDate` | Deal age calculation, velocity analysis |
| 9 | **Last Modified Date** | `LastModifiedDate` | DateTime | `updatedDate` | Ghost signal detection (14+ days no activity) |
| 10 | **Last Activity Date** | `LastActivityDate` | Date | `lastActivityDate` | Activity recency (more accurate than Last Modified) |
| 11 | **Next Step** | `NextStep` | Text | `nextStep` | Deal momentum assessment, action clarity |
| 12 | **Probability (%)** | `Probability` | Percent | `probability` | Cross-reference LLM risk score against rep's assessment |
| 13 | **Forecast Category** | `ForecastCategoryName` | Picklist | `forecastCategory` | Pipeline / Best Case / Commit |
| 14 | **Lead Source** | `LeadSource` | Picklist | `leadSource` | Channel effectiveness analysis |
| 15 | **Type** | `Type` | Picklist | `dealType` | New Business vs. Existing — different risk profiles |
| 16 | **Description** | `Description` | Long Text | _(composite notes)_ | Main deal narrative |

### Custom Fields (Simpro-specific)

These are custom fields (`__c`) in Simpro's Salesforce org. The parser accepts column names with or without the `__c` suffix, and also recognizes the human-readable label (e.g., "Why They Bought").

| # | Column Name | SF API Name | Usage | Why the LLM Needs It |
|---|---|---|---|---|
| 17 | **Category** | _(custom)_ | `winLossStatus` | "Closed_Won" / "Closed_Lost" / "In_Flight" |
| 18 | **Why They Bought** | `Why_They_Bought__c` | Composite notes (win) | Win theme extraction |
| 19 | **Reason for Win** | `Reason_for_Win__c` | `winLossReason` + notes | Win driver pattern detection |
| 20 | **Win Notes / Win Story** | `Win_Notes__c` / `Win_Story__c` | Composite notes (win) | Detailed win narrative |
| 21 | **Deal Takeaways** | `Deal_Takeaways__c` | Composite notes | Post-deal learnings |
| 22 | **Path to Purchase** | `Path_to_Purchase__c` | Composite notes | Buyer journey mapping |
| 23 | **Lost Reason** | `Lost_Reason__c` | Composite notes (loss) | Loss theme extraction |
| 24 | **Lost Reason Details** | `Lost_Reason_Details__c` | Composite notes (loss) | Detailed loss narrative |
| 25 | **Missing Features** | `Missing_Features__c` | Composite notes (loss) | Product gap identification |
| 26 | **Why Wouldn't Buy** | `Why_Wouldnt_Buy__c` | Composite notes (loss) | Objection analysis |
| 27 | **Main Competitor** | `Main_Competitor__c` | Competitor extraction | Competitive intelligence |
| 28 | **Manager Notes** | `Manager_Notes__c` | Composite notes | Manager's deal assessment |
| 29 | **Close Plan** | `Close_Plan__c` | `dealReviewNotes` | Deal execution strategy |
| 30 | **Why Would Buy** | `Why_Would_Buy__c` | Composite notes (win) | Buyer intent signals |
| 31 | **Price Reason** | `Price_Reason__c` | `winLossReason` (lost deals) | Pricing pressure signals |
| 32 | **Economic Buyer** | `Economic_Buyer__c` | `economicBuyer` + notes | Stakeholder identification |
| 33 | **simPRO Company** | `simPRO_Company__c` | `productLine` | Product line (Premium / Subscription) |

### Region Detection Fields

| # | Salesforce Report Column | SF API Name | Type | Usage |
|---|---|---|---|---|
| 34 | **Territory Region** | _(custom)_ | Text | Priority 1 for region (if populated) |
| 35 | **Currency** | `CurrencyIsoCode` | Text | Priority 2: AUD/NZD->APAC, GBP->EMEA, USD->NAMER |
| 36 | **Account: Billing State/Province** | `Account.BillingState` | Text | Priority 3: State-to-region mapping |
| 37 | **Account: Billing Country** | `Account.BillingCountry` | Text | Priority 4: Country-to-region mapping |
| 38 | **Account: Industry** | `Account.Industry` | Picklist | `industry` + Priority 5 region fallback |

---

## Tier 3: Enhanced Intelligence Fields (Future)

Not currently parsed, but would unlock advanced analytics.

### Stakeholder Mapping (requires "Opportunities with Contact Roles" report type)

| # | Column | SF API Name | Source Object | Why It Matters |
|---|---|---|---|---|
| 39 | **Contact: Full Name** | `Contact.Name` | OpportunityContactRole | Stakeholder identification |
| 40 | **Contact: Title** | `Contact.Title` | OpportunityContactRole | Economic buyer / champion detection |
| 41 | **Contact Role** | `Role` | OpportunityContactRole | Decision Maker, Champion, Evaluator |
| 42 | **Primary Contact** | `IsPrimary` | OpportunityContactRole | Single-threading risk |

### Company Size & Segment

| # | Column | SF API Name | Why It Matters |
|---|---|---|---|
| 43 | **Account: Employees** | `Account.NumberOfEmployees` | SMB vs. mid-market vs. enterprise segmentation |
| 44 | **Account: Annual Revenue** | `Account.AnnualRevenue` | Customer financial health |

### Product Detail (requires Products enabled)

| # | Column | SF API Name | Why It Matters |
|---|---|---|---|
| 45 | **Product Name** | `Product2.Name` | Win rate by product |
| 46 | **Product Family** | `Product2.Family` | Category-level analysis |

---

## Salesforce Report Configuration

### Report Type
**"Opportunities"** (standard) — gives access to all Opportunity fields plus Account cross-object fields.

For Tier 3 stakeholder data, use **"Opportunities with Contact Roles"** report type.

### Filters
- **Close Date:** Relative date range (e.g., "Last 90 Days" or "This Quarter and Last Quarter")
- **Stage:** All stages (include Closed Won and Closed Lost for win/loss analysis)
- **Record Type:** Filter to relevant opportunity types if your org has multiple

### Export Instructions
1. Build the report in Salesforce with all columns from Tiers 1 + 2
2. Run the report
3. **Export Details** -> **CSV** (not Excel)
4. Upload the CSV to Project Prism via the dashboard or `uploadCSV` endpoint

---

## What the LLM Analyzes

### Per Deal (8 Risk Signals)

| Signal | What Triggers It |
|---|---|
| **Ghost Signal** | No activity in 14+ days after proposal/quote |
| **Champion Risk** | Single-threaded to one contact |
| **Economic Buyer Gap** | No CFO/MD/Owner identified for deals >$25K |
| **Stage Compression** | Close date too soon for current stage |
| **Price Anchoring Risk** | Discount offered without documented negotiation |
| **Competitive Blind Spot** | No competitor identified for deals >$10K |
| **Implementation Anxiety** | Notes contain concern language |
| **Partner Misalignment** | Partner pricing conflicts with direct |

### Per Deal (Intelligence Extraction from Notes)
- Buyer sentiment, decision-making dynamic, buying trigger
- Blocking factors, competitive positioning
- External influencer mentions, integration requirements
- Deal health score (0-100) across 5 dimensions

### Portfolio Level (Aggregated)
- Executive briefing (3-sentence insight for CRO)
- 5 prioritized recommendations (P1/P2/P3) with revenue impact
- Forecast confidence with upside/downside scenarios
- Pattern detection: geographic, vertical, competitor, deal size, rep/manager clustering

---

## Future: API Integration Path

**Phase 1 (now):** Manual CSV export from Salesforce Reports.

**Phase 2 (future):** Salesforce REST API + SOQL for automated, incremental pulls:
- Query related objects (Contact Roles, Activities, Products) in a single call
- Scheduled pulls without manual export
- Incremental updates via `WHERE LastModifiedDate > :lastSync`
