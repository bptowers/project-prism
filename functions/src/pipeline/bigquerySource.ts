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
}

/**
 * Default BigQuery column-to-OpportunityRecord field mapping.
 * Keys are internal field names; values are expected BigQuery column names
 * based on Salesforce API names from Prism-Data-Requirements-Spec.docx.
 */
const DEFAULT_BQ_FIELD_MAP: Record<string, string[]> = {
  // Core Opportunity Fields (Section 2.1)
  opportunityId: ["Id", "Opportunity_ID", "OpportunityId"],
  accountName: ["Account_Name", "Account.Name", "AccountName"],
  opportunityName: ["Name", "Opportunity_Name", "OpportunityName"],
  stage: ["StageName", "Stage", "Stage_Name"],
  expectedMRR: ["Expected_MRR__c", "Expected_MRR", "ExpectedMRR"],
  amount: ["Amount"],
  closedDate: ["CloseDate", "Close_Date"],
  closed: ["IsClosed", "Closed"],
  won: ["IsWon", "Won"],
  currency: ["CurrencyIsoCode", "Currency"],

  // Owner & Activity Fields (Section 2.2)
  salesRep: ["Owner_Name", "Owner.Name", "Opportunity_Owner"],
  createdDate: ["CreatedDate", "Created_Date"],
  updatedDate: ["LastModifiedDate", "Last_Modified_Date"],
  lastActivityDate: ["LastActivityDate", "Last_Activity_Date"],
  nextStep: ["NextStep", "Next_Step"],
  probability: ["Probability"],
  forecastCategory: ["ForecastCategoryName", "Forecast_Category"],
  leadSource: ["LeadSource", "Lead_Source"],
  dealType: ["Type"],

  // Region & Geography Fields (Section 2.3)
  territoryRegion: ["Territory_Region__c", "Territory_Region"],
  billingState: ["BillingState", "Billing_State"],
  billingCountry: ["BillingCountry", "Billing_Country"],
  industry: ["Industry"],

  // Simpro Custom Fields (Section 2.4)
  description: ["Description"],
  whyTheyBought: ["Why_They_Bought__c", "Why_They_Bought"],
  reasonForWin: ["Reason_for_Win__c", "Reason_for_Win"],
  winNotes: ["Win_Notes__c", "Win_Notes"],
  winStory: ["Win_Story__c", "Win_Story"],
  dealTakeaways: ["Deal_Takeaways__c", "Deal_Takeaways"],
  pathToPurchase: ["Path_to_Purchase__c", "Path_to_Purchase"],
  managerNotes: ["Manager_Notes__c", "Manager_Notes"],
  closePlan: ["Close_Plan__c", "Close_Plan"],
  whyWouldBuy: ["Why_Would_Buy__c", "Why_Would_Buy"],
  whyWouldntBuy: ["Why_Wouldnt_Buy__c", "Why_Wouldnt_Buy"],
  lostReason: ["Lost_Reason__c", "Lost_Reason"],
  lostReasonDetails: ["Lost_Reason_Details__c", "Lost_Reason_Details"],
  lostNotes: ["Lost_Notes__c", "Lost_Notes"],
  missingFeatures: ["Missing_Features__c", "Missing_Features"],
  mainCompetitor: ["Main_Competitor__c", "Main_Competitor"],
  priceReason: ["Price_Reason__c", "Price_Reason"],
  economicBuyer: ["Economic_Buyer__c", "Economic_Buyer"],
  productLine: ["simPRO_Company__c", "simPRO_Company"],
};

/**
 * Currency code to region mapping
 */
const CURRENCY_REGION_MAP: Record<string, string> = {
  "AUD": "APAC",
  "NZD": "APAC",
  "GBP": "EMEA",
  "EUR": "EMEA",
  "USD": "NAMER",
  "CAD": "NAMER",
};

/**
 * Country/state to region mapping for geographic detection
 */
const GEO_REGION_MAP: Record<string, string> = {
  "australia": "APAC",
  "new zealand": "APAC",
  "japan": "APAC",
  "singapore": "APAC",
  "india": "APAC",
  "united kingdom": "EMEA",
  "ireland": "EMEA",
  "germany": "EMEA",
  "france": "EMEA",
  "england": "EMEA",
  "scotland": "EMEA",
  "wales": "EMEA",
  "united states": "NAMER",
  "canada": "NAMER",
  "mexico": "LATAM",
  "brazil": "LATAM",
  // Australian states
  "new south wales": "APAC",
  "queensland": "APAC",
  "victoria": "APAC",
  "western australia": "APAC",
  "south australia": "APAC",
  "tasmania": "APAC",
  "australian capital territory": "APAC",
  "northern territory": "APAC",
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
    const options: BigQueryOptions = {
      projectId: config.projectId,
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
    const query = this.buildQuery();
    console.log(
      `[BigQuerySource] Executing query against ${this.config.dataset}.${this.config.table}`
    );

    const [rows] = await this.client.query({
      query,
      location: this.config.location || "US",
    });

    console.log(`[BigQuerySource] Fetched ${rows.length} rows from BigQuery`);

    return rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  /**
   * Builds the SQL query with optional date filter for incremental pulls
   */
  private buildQuery(): string {
    const fullTable = `\`${this.config.projectId}.${this.config.dataset}.${this.config.table}\``;
    let query = `SELECT * FROM ${fullTable}`;

    if (this.config.sinceDate) {
      const dateCol = this.resolveColumn("updatedDate") || "LastModifiedDate";
      query += ` WHERE ${dateCol} >= '${this.config.sinceDate}'`;
    }

    const orderCol = this.resolveColumn("updatedDate") || "LastModifiedDate";
    query += ` ORDER BY ${orderCol} DESC`;

    return query;
  }

  /**
   * Resolves the first matching column name from the field map
   * against the actual row data (for query building, uses first candidate)
   */
  private resolveColumn(fieldName: string): string | undefined {
    const candidates = this.fieldMap[fieldName];
    return candidates?.[0];
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
      if (territoryRegion.includes("APAC") || territoryRegion.includes("ASIA") || territoryRegion.includes("PACIFIC")) return "APAC";
      if (territoryRegion.includes("EMEA") || territoryRegion.includes("EUROPE")) return "EMEA";
      if (territoryRegion.includes("NAMER") || territoryRegion.includes("NORTH AMERICA") || territoryRegion.includes("NA")) return "NAMER";
      if (territoryRegion.includes("LATAM") || territoryRegion.includes("LATIN")) return "LATAM";
      if (["APAC", "EMEA", "NAMER", "LATAM"].includes(territoryRegion)) return territoryRegion;
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
  };
}
