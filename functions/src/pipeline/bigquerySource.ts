/**
 * Project Prism - BigQuery Data Source Module
 * Fetches Salesforce opportunity data from BigQuery and maps to OpportunityRecord[]
 */

import { BigQuery, BigQueryOptions } from "@google-cloud/bigquery";
import { OpportunityRecord } from "../types.js";

/**
 * Configuration for BigQuery data source
 */
export interface BigQueryConfig {
  projectId: string;
  dataset: string;
  table: string;
  location?: string;
  sinceDate?: string; // ISO date string for incremental pulls (e.g. "2026-02-18")
  limit?: number; // Max records to fetch (default 300)
  createdMonths?: number; // exclude deals created more than this many months ago (default 18)
  closeDaysPast?: number; // exclude deals whose close date is more than this many days past (default 90)
}

/**
 * Default BigQuery column-to-OpportunityRecord field mapping.
 * Keys are internal field names; values are expected BigQuery column names
 * based on Salesforce API names from Prism-Data-Requirements-Spec.docx.
 */
const DEFAULT_BQ_FIELD_MAP: Record<string, string[]> = {
  // Each array lists candidates in priority order. The first candidates were
  // verified against the production table's INFORMATION_SCHEMA (2026-07-15,
  // edw-simprogroup-propagation.SF_Simpro.sf_opportunity); later entries are
  // Salesforce API-name fallbacks kept in case the warehouse schema changes.

  // Core Opportunity Fields
  opportunityId: ["id", "Id", "Opportunity_ID", "OpportunityId"],
  accountName: ["account_name", "Account_Name", "Account.Name", "AccountName"],
  opportunityName: ["name", "Name", "Opportunity_Name", "OpportunityName"],
  stage: ["stage_name", "StageName", "Stage", "Stage_Name"],
  expectedMRR: ["expected_mrr_c", "Expected_MRR__c", "Expected_MRR", "ExpectedMRR"],
  amount: ["amount", "Amount"],
  closedDate: ["close_date", "CloseDate", "Close_Date"],
  closed: ["is_closed", "IsClosed", "Closed"],
  won: ["is_won", "IsWon", "Won"],
  currency: ["currency_iso_code", "CurrencyIsoCode", "Currency"],

  // Owner & Activity Fields
  salesRep: ["owner_name", "Owner_Name", "Owner.Name", "Opportunity_Owner"],
  createdDate: ["created_date", "CreatedDate", "Created_Date"],
  // No LastModifiedDate column exists in the table. _fivetran_start is when the
  // current row version became active — i.e. the last time the record changed —
  // so it's the best modification-time proxy (verified: values vary per record).
  // Caveat: records untouched since the initial Fivetran sync all share that
  // sync date (2026-04-13) as a floor. _fivetran_synced kept as fallback.
  updatedDate: ["_fivetran_start", "_fivetran_synced"],
  // No LastActivityDate column exists in the table — this resolves empty and
  // dealMetrics falls back to updatedDate for activity-recency calculations.
  lastActivityDate: ["LastActivityDate", "Last_Activity_Date"],
  // Reps use the long-text field: next_step_long_text is populated on ~77% of
  // open deals vs <1% for next_step. Order matters for velocity/stall metrics.
  nextStep: ["next_step_long_text", "next_step", "NextStep", "Next_Step"],
  probability: ["probability", "Probability"],
  forecastCategory: ["forecast_category", "ForecastCategoryName", "Forecast_Category"],
  leadSource: ["lead_source", "LeadSource", "Lead_Source"],
  dealType: ["type", "Type"],

  // Region & Geography Fields
  territoryRegion: ["sales_region", "strategic_territory", "Territory_Region__c", "Territory_Region"],
  // No billing_state/billing_country columns exist — region detection relies on
  // sales_region/strategic_territory (priority 1) and currency (priority 2).
  billingState: ["BillingState", "Billing_State"],
  billingCountry: ["BillingCountry", "Billing_Country"],
  industry: ["industry", "Industry"],

  // Notes & Deal-Context Fields (feed the composite notes sent to the LLM).
  // The table uses plain snake_case names without the _c suffix for most of
  // these — the verified column name must come first or the field resolves
  // empty and the LLM never sees it.
  description: ["Description", "description"],
  whyTheyBought: ["Why_They_Bought__c", "why_they_bought_c"],
  reasonForWin: ["reason_for_win", "Reason_for_Win__c", "reason_for_win_c"],
  winNotes: ["win_notes", "Win_Notes__c", "win_notes_c"],
  winStory: ["Win_Story__c", "win_story_c"],
  dealTakeaways: ["Deal_Takeaways__c", "deal_takeaways_c"],
  pathToPurchase: ["path_to_purchase", "Path_to_Purchase__c", "path_to_purchase_c"],
  managerNotes: ["manager_notes", "Manager_Notes__c", "manager_notes_c"],
  closePlan: ["close_plan", "Close_Plan__c", "close_plan_c"],
  whyWouldBuy: ["why_would_they_buy_from_us", "Why_Would_Buy__c", "why_would_buy_c"],
  whyWouldntBuy: ["why_wouldnt_they_buy_from_us", "Why_Wouldnt_Buy__c", "why_wouldnt_buy_c"],
  lostReason: ["lost_reason", "Lost_Reason__c", "lost_reason_c"],
  lostReasonDetails: ["Lost_Reason_Details__c", "lost_reason_details_c"],
  lostNotes: ["lost_notes", "Lost_Notes__c", "lost_notes_c"],
  missingFeatures: ["Missing_Features__c", "missing_features_c"],
  mainCompetitor: ["competitor_name", "Main_Competitor__c", "main_competitor_c"],
  priceReason: ["Price_Reason__c", "price_reason_c"],
  economicBuyer: ["who_is_signing_economic_buyer", "Economic_Buyer__c", "economic_buyer_c"],
  productLine: ["sim_pro_company_c", "simPRO_Company__c", "simPRO_Company"],
};

/**
 * Currency code to region mapping
 */
const CURRENCY_REGION_MAP: Record<string, string> = {
  "AUD": "ANZ",
  "NZD": "ANZ",
  "GBP": "UK",
  "EUR": "UK",
  "USD": "NAMER",
  "CAD": "NAMER",
};

/**
 * Country/state to region mapping for geographic detection
 */
const GEO_REGION_MAP: Record<string, string> = {
  "australia": "ANZ",
  "new zealand": "ANZ",
  "japan": "ANZ",
  "singapore": "ANZ",
  "india": "ANZ",
  "united kingdom": "UK",
  "ireland": "UK",
  "germany": "UK",
  "france": "UK",
  "england": "UK",
  "scotland": "UK",
  "wales": "UK",
  "united states": "NAMER",
  "canada": "NAMER",
  // Australian states
  "new south wales": "ANZ",
  "queensland": "ANZ",
  "victoria": "ANZ",
  "western australia": "ANZ",
  "south australia": "ANZ",
  "tasmania": "ANZ",
  "australian capital territory": "ANZ",
  "northern territory": "ANZ",
};

/**
 * BigQuery data source for Salesforce opportunity records.
 * Queries BigQuery and maps rows to OpportunityRecord[].
 */
export class BigQuerySource {
  private client: BigQuery;
  private config: BigQueryConfig;
  private fieldMap: Record<string, string[]>;

  constructor(config: BigQueryConfig, fieldMap?: Record<string, string[]>) {
    // Don't set projectId here — let it default to the Firebase project so
    // query jobs run under our own service account's project. The query itself
    // references the full table path (e.g. `bq-project.dataset.table`), so
    // data is still read from the remote project via BigQuery Data Viewer role.
    const options: BigQueryOptions = {
      location: config.location || "US",
    };
    this.client = new BigQuery(options);
    this.config = config;
    this.fieldMap = fieldMap || DEFAULT_BQ_FIELD_MAP;
  }

  /**
   * Fetches opportunity records from BigQuery
   */
  async fetchRecords(): Promise<OpportunityRecord[]> {
    const { query, params } = this.buildQuery();
    console.log(
      `[BigQuerySource] Executing query against ${this.config.dataset}.${this.config.table}`
    );

    const [rows] = await this.client.query({
      query,
      params,
      location: this.config.location || "US",
    });

    console.log(`[BigQuerySource] Fetched ${rows.length} rows from BigQuery`);

    if (rows.length > 0) {
      console.log(`[BigQuerySource] Columns found: ${Object.keys(rows[0]).join(", ")}`);

      // Log region value distribution for diagnostics
      const regionCounts: Record<string, number> = {};
      for (const row of rows) {
        const regionVal = String(row["sales_region"] || row["strategic_territory"] || "EMPTY").trim();
        regionCounts[regionVal] = (regionCounts[regionVal] || 0) + 1;
      }
      console.log(`[BigQuerySource] Region distribution: ${JSON.stringify(regionCounts)}`);
    }

    return rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  /**
   * Builds the SQL query with optional date filter for incremental pulls.
   * Uses parameterized queries to prevent SQL injection.
   */
  private buildQuery(): { query: string; params: Record<string, unknown> } {
    const fullTable = `\`${this.config.projectId}.${this.config.dataset}.${this.config.table}\``;

    const orderCandidates = this.fieldMap["createdDate"] || ["created_date"];
    const orderCol = orderCandidates[0];
    const closeDateCandidates = this.fieldMap["closedDate"] || ["close_date"];
    const closeDateCol = closeDateCandidates[0];
    const limit = this.config.limit ?? 300;

    // _fivetran_active guards against Fivetran history mode ever retaining
    // superseded row versions (currently all rows are active, but the columns
    // exist so the mode could be enabled upstream without warning).
    const filters: string[] = [
      "COALESCE(_fivetran_active, TRUE)",
      "is_closed = FALSE",
      "LOWER(COALESCE(type, '')) = 'new business'",
    ];
    const params: Record<string, unknown> = {};

    if (this.config.sinceDate) {
      filters.push(`${orderCol} >= @sinceDate`);
      params.sinceDate = this.config.sinceDate;
    }

    // Exclude zombie deals created too long ago (LastActivityDate not available in this table)
    const createdMonths = this.config.createdMonths ?? 18;
    const createdSince = new Date(Date.now() - createdMonths * 30.44 * 86_400_000).toISOString().slice(0, 10);
    filters.push(`${orderCol} >= @createdSince`);
    params.createdSince = createdSince;

    // Exclude deals with close dates far in the past (allow NULL — open-ended deals)
    const closeDaysPast = this.config.closeDaysPast ?? 90;
    const closeSince = new Date(Date.now() - closeDaysPast * 86_400_000).toISOString().slice(0, 10);
    filters.push(`(${closeDateCol} >= @closeSince OR ${closeDateCol} IS NULL)`);
    params.closeSince = closeSince;

    // Exclude deals with no pipeline value — these are test records, admin placeholders,
    // or entries where MRR was never entered, all of which produce meaningless LLM output.
    filters.push("amount IS NOT NULL AND SAFE_CAST(amount AS FLOAT64) > 0");

    return {
      query: `SELECT * FROM ${fullTable} WHERE ${filters.join(" AND ")} ORDER BY ${closeDateCol} ASC LIMIT ${limit}`,
      params,
    };
  }


  /**
   * Gets a string value from a BigQuery row, trying multiple column name candidates
   */
  private getString(row: Record<string, unknown>, fieldName: string): string {
    const candidates = this.fieldMap[fieldName];
    if (!candidates) return "";

    for (const col of candidates) {
      const val = row[col];
      if (val !== null && val !== undefined) {
        // BigQuery TIMESTAMP/DATE values may be objects — convert to string
        if (val instanceof Date) {
          return val.toISOString();
        }
        if (typeof val === "object" && "value" in (val as Record<string, unknown>)) {
          return String((val as Record<string, unknown>).value).trim();
        }
        return String(val).trim();
      }
    }

    return "";
  }

  /**
   * Gets a number value from a BigQuery row
   */
  private getNumber(row: Record<string, unknown>, fieldName: string): number | undefined {
    const candidates = this.fieldMap[fieldName];
    if (!candidates) return undefined;

    for (const col of candidates) {
      const val = row[col];
      if (val !== null && val !== undefined) {
        const num = typeof val === "number" ? val : parseFloat(String(val));
        if (!isNaN(num)) return num;
      }
    }

    return undefined;
  }

  /**
   * Maps a BigQuery row to an OpportunityRecord
   */
  private mapRow(row: Record<string, unknown>): OpportunityRecord {
    const stage = this.getString(row, "stage");
    const winLossStatus = this.deriveWinLossStatus(stage, row);

    // Revenue: prefer Expected MRR over Amount (per Simpro data spec)
    const expectedMRR = this.getNumber(row, "expectedMRR");
    const amount = expectedMRR ?? this.getNumber(row, "amount");

    const record: OpportunityRecord = {
      opportunityId: this.getString(row, "opportunityId"),
      accountName: this.getString(row, "accountName"),
      opportunityName: this.getString(row, "opportunityName"),
      stage,
      winLossStatus,
      notes: this.getString(row, "description"),
      region: "Unknown",
      amount,
      expectedMRR,
      closedDate: this.getString(row, "closedDate"),
      winLossReason: "",
      industry: this.getString(row, "industry"),
      dealReviewNotes: this.getString(row, "closePlan"),
      createdDate: this.getString(row, "createdDate"),
      updatedDate: this.getString(row, "updatedDate"),
      salesRep: this.getString(row, "salesRep"),
      lastActivityDate: this.getString(row, "lastActivityDate"),
      nextStep: this.getString(row, "nextStep"),
      probability: this.getNumber(row, "probability"),
      forecastCategory: this.getString(row, "forecastCategory"),
      leadSource: this.getString(row, "leadSource"),
      dealType: this.getString(row, "dealType"),
      economicBuyer: this.getString(row, "economicBuyer"),
      productLine: this.getString(row, "productLine"),
    };

    // Build composite notes from multiple Salesforce fields
    record.notes = this.buildCompositeNotes(row, record.notes);

    // Build composite win/loss reason
    record.winLossReason = this.buildCompositeWinLossReason(row, winLossStatus);

    // Detect region using priority chain
    record.region = this.detectRegion(row, record);

    return record;
  }

  /**
   * Derives win/loss status from stage name and boolean columns
   * Same logic as CSVParser.deriveWinLossFromStageOrBooleans()
   */
  private deriveWinLossStatus(
    stage: string,
    row: Record<string, unknown>
  ): "won" | "lost" | "active" {
    // Check IsClosed/IsWon boolean columns
    const closedVal = this.getString(row, "closed").toLowerCase();
    const wonVal = this.getString(row, "won").toLowerCase();

    if (closedVal === "true" && wonVal === "true") return "won";
    if (closedVal === "true" && wonVal === "false") return "lost";

    // Derive from stage name
    const stageLower = stage.toLowerCase();
    if (stageLower.includes("closed won")) return "won";
    if (stageLower.includes("closed lost")) return "lost";

    return "active";
  }

  /**
   * Detects region using priority chain:
   * Territory Region > Currency > Billing State > Billing Country > Account name
   * Same logic as CSVParser.detectRegion()
   */
  private detectRegion(
    row: Record<string, unknown>,
    record: OpportunityRecord
  ): string {
    // Priority 1: Explicit Territory_Region column
    const territoryRegion = this.getString(row, "territoryRegion").toUpperCase();
    if (territoryRegion) {
      // Simpro-specific region values (from BigQuery sales_region column)
      if (territoryRegion === "SIMPRO ANZ" || territoryRegion.includes("ANZ")) return "ANZ";
      if (territoryRegion === "SIMPRO EU" || territoryRegion === "SIMPRO UK" || territoryRegion.endsWith(" EU") || territoryRegion.endsWith(" UK")) return "UK";
      if (territoryRegion === "SIMPRO NA" || territoryRegion.endsWith(" NA")) return "NAMER";
      // Generic region values
      if (territoryRegion.includes("APAC") || territoryRegion.includes("ASIA") || territoryRegion.includes("PACIFIC")) return "ANZ";
      if (territoryRegion.includes("EMEA") || territoryRegion.includes("EUROPE")) return "UK";
      if (territoryRegion.includes("NAMER") || territoryRegion.includes("NORTH AMERICA")) return "NAMER";
    }

    // Priority 2: Currency-based detection
    const currency = this.getString(row, "currency").toUpperCase();
    if (CURRENCY_REGION_MAP[currency]) {
      return CURRENCY_REGION_MAP[currency];
    }

    // Priority 3: Billing state
    const billingState = this.getString(row, "billingState").toLowerCase();
    if (billingState && GEO_REGION_MAP[billingState]) {
      return GEO_REGION_MAP[billingState];
    }

    // Priority 4: Billing country
    const billingCountry = this.getString(row, "billingCountry").toLowerCase();
    if (billingCountry && GEO_REGION_MAP[billingCountry]) {
      return GEO_REGION_MAP[billingCountry];
    }

    // Priority 5: Account name / industry substring matching
    const accountLower = record.accountName.toLowerCase();
    const industryLower = record.industry?.toLowerCase() || "";
    for (const [key, region] of Object.entries(GEO_REGION_MAP)) {
      if (accountLower.includes(key) || industryLower.includes(key)) {
        return region;
      }
    }

    return "Unknown";
  }

  /**
   * Builds composite notes from multiple Salesforce custom fields
   * Same logic as CSVParser.buildCompositeNotes()
   */
  private buildCompositeNotes(
    row: Record<string, unknown>,
    existingNotes: string
  ): string {
    const noteFields: Array<{ key: string; label: string }> = [
      { key: "description", label: "Description" },
      { key: "whyTheyBought", label: "Why They Bought" },
      { key: "reasonForWin", label: "Win Reason" },
      { key: "winNotes", label: "Win Notes" },
      { key: "winStory", label: "Win Story" },
      { key: "dealTakeaways", label: "Deal Takeaways" },
      { key: "pathToPurchase", label: "Path to Purchase" },
      { key: "managerNotes", label: "Manager Notes" },
      { key: "whyWouldBuy", label: "Why Would Buy" },
      { key: "whyWouldntBuy", label: "Why Wouldn't Buy" },
      { key: "lostReason", label: "Lost Reason" },
      { key: "lostReasonDetails", label: "Lost Details" },
      { key: "lostNotes", label: "Lost Notes" },
      { key: "missingFeatures", label: "Missing Features" },
      { key: "mainCompetitor", label: "Main Competitor" },
      { key: "economicBuyer", label: "Economic Buyer" },
    ];

    const parts: string[] = [];
    if (existingNotes) {
      parts.push(existingNotes);
    }

    for (const { key, label } of noteFields) {
      const value = this.getString(row, key);
      if (value) {
        parts.push(`${label}: ${value}`);
      }
    }

    return parts.join(" | ");
  }

  /**
   * Builds composite win/loss reason from relevant Salesforce fields
   * Same logic as CSVParser.buildCompositeWinLossReason()
   */
  private buildCompositeWinLossReason(
    row: Record<string, unknown>,
    status: "won" | "lost" | "active"
  ): string {
    const parts: string[] = [];

    if (status === "won") {
      const reasonForWin = this.getString(row, "reasonForWin");
      const whyBought = this.getString(row, "whyTheyBought");
      if (reasonForWin) parts.push(reasonForWin);
      if (whyBought) parts.push(whyBought);
    } else if (status === "lost") {
      const lostReason = this.getString(row, "lostReason");
      const lostDetails = this.getString(row, "lostReasonDetails");
      const priceReason = this.getString(row, "priceReason");
      if (lostReason) parts.push(lostReason);
      if (lostDetails) parts.push(lostDetails);
      if (priceReason) parts.push(`Price factor: ${priceReason}`);
    }

    return parts.join(" | ");
  }
}

/**
 * Reads BigQuery config from environment variables
 */
export function getBigQueryConfig(): BigQueryConfig {
  const projectId = process.env.BQ_PROJECT_ID;
  const dataset = process.env.BQ_DATASET;
  const table = process.env.BQ_TABLE;

  if (!projectId || !dataset || !table) {
    throw new Error(
      "BigQuery configuration missing. Set BQ_PROJECT_ID, BQ_DATASET, and BQ_TABLE environment variables."
    );
  }

  return {
    projectId,
    dataset,
    table,
    location: process.env.BQ_LOCATION || "US",
    limit: process.env.BQ_LIMIT ? parseInt(process.env.BQ_LIMIT, 10) : 300,
    createdMonths: process.env.BQ_CREATED_MONTHS ? parseInt(process.env.BQ_CREATED_MONTHS, 10) : 18,
    closeDaysPast: process.env.BQ_CLOSE_DAYS_PAST ? parseInt(process.env.BQ_CLOSE_DAYS_PAST, 10) : 90,
  };
}
