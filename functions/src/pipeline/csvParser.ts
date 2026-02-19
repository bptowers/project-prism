/**
 * Project Prism - CSV Parser Module
 * Handles ingestion and parsing of Salesforce CSV exports
 */

import { parse } from "csv-parse/sync";
import { FieldMapping, OpportunityRecord, RegionMapping } from "../types.js";

/**
 * CSV Parser for Salesforce exports
 * Handles field mapping, region tagging, and data validation
 */
export class CSVParser {
  private fieldMapping: FieldMapping;
  private regionMapping: RegionMapping;

  /**
   * Initialize CSV parser with field and region mappings
   */
  constructor(fieldMapping: FieldMapping, regionMapping: RegionMapping) {
    this.fieldMapping = fieldMapping;
    this.regionMapping = regionMapping;
  }

  /**
   * Parses CSV content and returns typed opportunity records
   * @param csvContent Raw CSV file content
   * @returns Array of parsed opportunity records
   * @throws Error if CSV is malformed or required fields are missing
   */
  parse(csvContent: string): OpportunityRecord[] {
    try {
      // Parse CSV using csv-parse
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relaxColumnCount: true,
        relaxQuotes: true,
      }) as Record<string, unknown>[];

      if (records.length === 0) {
        throw new Error("CSV file is empty");
      }

      return records.map((record) => this.mapRecord(record));
    } catch (error) {
      throw new Error(`Failed to parse CSV: ${String(error)}`);
    }
  }

  /**
   * Maps a raw CSV record to OpportunityRecord schema
   */
  private mapRecord(rawRecord: Record<string, unknown>): OpportunityRecord {
    const stage = this.getFieldValue(rawRecord, this.fieldMapping.stage);

    // Determine win/loss status: try explicit column first, then derive from Stage or Closed/Won booleans
    const explicitStatus = this.getFieldValue(rawRecord, this.fieldMapping.winLossStatus);
    const winLossStatus = explicitStatus
      ? this.normalizeWinLossStatus(explicitStatus)
      : this.deriveWinLossFromStageOrBooleans(stage, rawRecord);

    const record: OpportunityRecord = {
      opportunityId: this.getFieldValue(
        rawRecord,
        this.fieldMapping.opportunityId
      ),
      accountName: this.getFieldValue(
        rawRecord,
        this.fieldMapping.accountName
      ),
      opportunityName: this.getFieldValue(
        rawRecord,
        this.fieldMapping.opportunityName
      ),
      stage,
      winLossStatus,
      notes: this.getFieldValue(rawRecord, this.fieldMapping.notes) || "",
      region: "Unknown",
    };

    // Optional mapped fields
    if (this.fieldMapping.amount) {
      const amount = this.getFieldValue(rawRecord, this.fieldMapping.amount);
      record.amount = this.parseAmount(amount);
    }

    if (this.fieldMapping.closedDate) {
      record.closedDate = this.getFieldValue(
        rawRecord,
        this.fieldMapping.closedDate
      );
    }

    if (this.fieldMapping.winLossReason) {
      record.winLossReason = this.getFieldValue(
        rawRecord,
        this.fieldMapping.winLossReason
      );
    }

    if (this.fieldMapping.industry) {
      record.industry = this.getFieldValue(
        rawRecord,
        this.fieldMapping.industry
      );
    }

    if (this.fieldMapping.dealReviewNotes) {
      record.dealReviewNotes = this.getFieldValue(
        rawRecord,
        this.fieldMapping.dealReviewNotes
      );
    }

    if (this.fieldMapping.createdDate) {
      record.createdDate = this.getFieldValue(
        rawRecord,
        this.fieldMapping.createdDate
      );
    }

    if (this.fieldMapping.updatedDate) {
      record.updatedDate = this.getFieldValue(
        rawRecord,
        this.fieldMapping.updatedDate
      );
    }

    if (this.fieldMapping.salesRep) {
      record.salesRep = this.getFieldValue(
        rawRecord,
        this.fieldMapping.salesRep
      );
    }

    // New Tier 2 fields — extracted directly from raw record with alternative name resolution
    const lastActivityDate = this.getFieldValue(rawRecord, "Last_Activity_Date");
    if (lastActivityDate) record.lastActivityDate = lastActivityDate;

    const nextStep = this.getFieldValue(rawRecord, "Next_Step");
    if (nextStep) record.nextStep = nextStep;

    const probability = this.getFieldValue(rawRecord, "Probability");
    if (probability) {
      const parsed = parseFloat(probability.replace("%", "").trim());
      if (!isNaN(parsed)) record.probability = parsed;
    }

    const forecastCategory = this.getFieldValue(rawRecord, "Forecast_Category");
    if (forecastCategory) record.forecastCategory = forecastCategory;

    const leadSource = this.getFieldValue(rawRecord, "Lead_Source");
    if (leadSource) record.leadSource = leadSource;

    const dealType = this.getFieldValue(rawRecord, "Type");
    if (dealType) record.dealType = dealType;

    const economicBuyer = this.getFieldValue(rawRecord, "Economic_Buyer");
    if (economicBuyer) record.economicBuyer = economicBuyer;

    const productLine = this.getFieldValue(rawRecord, "simPRO_Company");
    if (productLine) record.productLine = productLine;

    // Build composite notes from multiple real Salesforce fields
    record.notes = this.buildCompositeNotes(rawRecord, record.notes);

    // Build composite win/loss reason from real Salesforce fields
    record.winLossReason = this.buildCompositeWinLossReason(
      rawRecord,
      record.winLossStatus,
      record.winLossReason || ""
    );

    // Tag with region based on currency, billing state, or account name
    record.region = this.detectRegion(record, rawRecord);

    return record;
  }

  /**
   * Derives win/loss status from Stage name or Closed/Won boolean columns
   * when no explicit Category or Win_Loss_Status column is present.
   */
  private deriveWinLossFromStageOrBooleans(
    stage: string,
    rawRecord: Record<string, unknown>
  ): "won" | "lost" | "active" {
    // Check Closed/Won boolean columns (common in Salesforce exports)
    const closedVal = this.getFieldValue(rawRecord, "Closed").toLowerCase();
    const wonVal = this.getFieldValue(rawRecord, "Won").toLowerCase();

    if (closedVal === "true" && wonVal === "true") return "won";
    if (closedVal === "true" && wonVal === "false") return "lost";

    // Derive from stage name
    const stageLower = stage.toLowerCase();
    if (stageLower.includes("closed won")) return "won";
    if (stageLower.includes("closed lost")) return "lost";

    return "active";
  }

  /**
   * Gets field value from raw record, handling missing fields gracefully.
   * Tries the exact field name first, then common alternatives.
   */
  private getFieldValue(record: Record<string, unknown>, fieldName: string): string {
    // Try exact match first
    const value = record[fieldName];
    if (value !== null && value !== undefined) {
      return String(value).trim();
    }

    // Try alternative column names (Salesforce Report labels vs Data Loader API names)
    const alternatives = CSVParser.COLUMN_ALTERNATIVES[fieldName];
    if (alternatives) {
      for (const alt of alternatives) {
        const altValue = record[alt];
        if (altValue !== null && altValue !== undefined) {
          return String(altValue).trim();
        }
      }
    }

    return "";
  }

  /**
   * Maps common Salesforce column name variants.
   * Keys are the names used in our field mapping; values are alternatives
   * that may appear in Salesforce Report exports or Data Loader exports.
   */
  private static readonly COLUMN_ALTERNATIVES: Record<string, string[]> = {
    // Opportunity ID
    "Opportunity_ID": ["Opportunity ID", "Id", "OpportunityId", "Opportunity: ID"],
    // Account / Opportunity Name
    "Opportunity_Name": ["Opportunity Name", "Name", "Opportunity: Name"],
    "Account_Name": ["Account Name", "Account.Name", "Account: Account Name"],
    // Stage
    "Stage": ["StageName", "Stage Name", "Opportunity: Stage"],
    // Amount
    "Amount": ["Opportunity: Amount"],
    // Close Date
    "Close_Date": ["Close Date", "CloseDate", "Opportunity: Close Date"],
    // Category / Win-Loss
    "Category": ["Win_Loss_Status", "Forecast Category", "ForecastCategory", "ForecastCategoryName"],
    // Currency
    "Currency": ["CurrencyIsoCode", "Currency ISO Code", "Opportunity Currency"],
    // Billing State
    "Billing_State": ["Billing State/Province", "BillingState", "Account: Billing State/Province", "Billing_State/Province"],
    // Billing Country
    "Billing_Country": ["Billing Country", "BillingCountry", "Account: Billing Country"],
    // Owner / Sales Rep
    "Decision_Maker": ["Opportunity Owner", "Owner.Name", "Owner Full Name", "Owner: Full Name"],
    // Industry
    "Industry": ["Account: Industry", "Account.Industry"],
    // Dates
    "Created_Date": ["Created Date", "CreatedDate", "Opportunity: Created Date"],
    "Last_Modified_Date": ["Last Modified Date", "LastModifiedDate", "Last Modified", "Opportunity: Last Modified Date"],
    // New standard fields
    "Last_Activity_Date": ["Last Activity Date", "Last Activity", "LastActivityDate"],
    "Next_Step": ["Next Step", "NextStep"],
    "Probability": ["Probability (%)", "Probability"],
    "Forecast_Category": ["Forecast Category", "ForecastCategoryName"],
    "Lead_Source": ["Lead Source", "LeadSource"],
    "Type": ["Opportunity Type", "Type"],
    "Description": ["Opportunity: Description"],
    // Custom Simpro fields — try with and without __c suffix
    "Why_They_Bought": ["Why They Bought", "Why_They_Bought__c"],
    "Reason_for_Win": ["Reason for Win", "Reason_for_Win__c"],
    "Win_Notes": ["Win Notes", "Win_Notes__c"],
    "Win_Story": ["Win Story", "Win_Story__c"],
    "Deal_Takeaways": ["Deal Takeaways", "Deal_Takeaways__c"],
    "Path_to_Purchase": ["Path to Purchase", "Path_to_Purchase__c"],
    "Manager_Notes": ["Manager Notes", "Manager_Notes__c"],
    "Why_Would_Buy": ["Why Would Buy", "Why_Would_Buy__c"],
    "Why_Wouldnt_Buy": ["Why Wouldn't Buy", "Why_Wouldnt_Buy__c"],
    "Lost_Reason": ["Lost Reason", "Lost_Reason__c"],
    "Lost_Reason_Details": ["Lost Reason Details", "Lost_Reason_Details__c"],
    "Lost_Notes": ["Lost Notes", "Lost_Notes__c"],
    "Missing_Features": ["Missing Features", "Missing_Features__c"],
    "Main_Competitor": ["Main Competitor", "Main_Competitor__c"],
    "Close_Plan": ["Close Plan", "Close_Plan__c"],
    "Price_Reason": ["Price Reason", "Price_Reason__c"],
    "Economic_Buyer": ["Economic Buyer", "Economic_Buyer__c"],
    "simPRO_Company": ["simPRO Company", "simPRO_Company__c"],
    "Territory_Region": ["Territory Region", "Territory_Region__c"],
  };

  /**
   * Normalizes win/loss status values
   */
  private normalizeWinLossStatus(
    status: string
  ): "won" | "lost" | "active" {
    const normalized = status.toLowerCase().trim().replace(/_/g, " ");

    if (
      normalized.includes("won") ||
      normalized.includes("closed won") ||
      normalized === "true"
    ) {
      return "won";
    }

    if (
      normalized.includes("lost") ||
      normalized.includes("closed lost") ||
      normalized === "false"
    ) {
      return "lost";
    }

    return "active";
  }

  /**
   * Parses amount field, handling various formats
   */
  private parseAmount(amountStr: string): number | undefined {
    if (!amountStr) {
      return undefined;
    }

    // Remove currency symbols and commas
    const cleaned = amountStr
      .replace(/[$€£¥]/g, "")
      .replace(/,/g, "")
      .trim();

    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Detects region based on currency, billing state, account name, or industry
   */
  private detectRegion(
    record: OpportunityRecord,
    rawRecord?: Record<string, unknown>
  ): string {
    if (rawRecord) {
      // Priority 1: Explicit Territory_Region column (if populated)
      const territoryRegion = this.getFieldValue(rawRecord, "Territory_Region").toUpperCase();
      if (territoryRegion) {
        // Normalize common territory region values to our region codes
        if (territoryRegion.includes("APAC") || territoryRegion.includes("ASIA") || territoryRegion.includes("PACIFIC")) return "APAC";
        if (territoryRegion.includes("EMEA") || territoryRegion.includes("EUROPE")) return "EMEA";
        if (territoryRegion.includes("NAMER") || territoryRegion.includes("NORTH AMERICA") || territoryRegion.includes("NA")) return "NAMER";
        if (territoryRegion.includes("LATAM") || territoryRegion.includes("LATIN")) return "LATAM";
        // If it's a known region code already, use it
        if (["APAC", "EMEA", "NAMER", "LATAM"].includes(territoryRegion)) return territoryRegion;
      }

      // Priority 2: Currency-based detection (most reliable for real Salesforce data)
      const currency = this.getFieldValue(rawRecord, "Currency").toUpperCase();
      const currencyRegionMap: Record<string, string> = {
        "AUD": "APAC",
        "NZD": "APAC",
        "GBP": "EMEA",
        "USD": "NAMER",
        "CAD": "NAMER",
        "EUR": "EMEA",
      };
      if (currencyRegionMap[currency]) {
        return currencyRegionMap[currency];
      }

      // Priority 3: Billing state
      const billingState = this.getFieldValue(rawRecord, "Billing_State").toLowerCase();
      if (billingState) {
        for (const [key, region] of Object.entries(this.regionMapping)) {
          if (billingState === key.toLowerCase()) {
            return region;
          }
        }
      }

      // Priority 4: Billing country
      const billingCountry = this.getFieldValue(rawRecord, "Billing_Country").toLowerCase();
      if (billingCountry) {
        for (const [key, region] of Object.entries(this.regionMapping)) {
          if (billingCountry === key.toLowerCase()) {
            return region;
          }
        }
      }
    }

    // Priority 5: Match account name or industry against region mapping
    const accountLower = record.accountName.toLowerCase();
    const industryLower = record.industry?.toLowerCase() || "";

    for (const [key, region] of Object.entries(this.regionMapping)) {
      const keyLower = key.toLowerCase();
      if (
        accountLower.includes(keyLower) ||
        industryLower.includes(keyLower)
      ) {
        return region;
      }
    }

    return "Unknown";
  }

  /**
   * Builds composite notes from multiple Salesforce export fields
   */
  private buildCompositeNotes(
    rawRecord: Record<string, unknown>,
    existingNotes: string
  ): string {
    const noteFields = [
      { key: "Description", label: "Description" },
      { key: "Why_They_Bought", label: "Why They Bought" },
      { key: "Reason_for_Win", label: "Win Reason" },
      { key: "Win_Notes", label: "Win Notes" },
      { key: "Win_Story", label: "Win Story" },
      { key: "Deal_Takeaways", label: "Deal Takeaways" },
      { key: "Path_to_Purchase", label: "Path to Purchase" },
      { key: "Manager_Notes", label: "Manager Notes" },
      { key: "Why_Would_Buy", label: "Why Would Buy" },
      { key: "Why_Wouldnt_Buy", label: "Why Wouldn't Buy" },
      { key: "Lost_Reason", label: "Lost Reason" },
      { key: "Lost_Reason_Details", label: "Lost Details" },
      { key: "Lost_Notes", label: "Lost Notes" },
      { key: "Missing_Features", label: "Missing Features" },
      { key: "Main_Competitor", label: "Main Competitor" },
      { key: "Economic_Buyer", label: "Economic Buyer" },
    ];

    const parts: string[] = [];
    if (existingNotes) {
      parts.push(existingNotes);
    }

    for (const { key, label } of noteFields) {
      const value = this.getFieldValue(rawRecord, key);
      if (value) {
        parts.push(`${label}: ${value}`);
      }
    }

    return parts.join(" | ");
  }

  /**
   * Builds composite win/loss reason from relevant Salesforce fields
   */
  private buildCompositeWinLossReason(
    rawRecord: Record<string, unknown>,
    status: "won" | "lost" | "active",
    existingReason: string
  ): string {
    const parts: string[] = [];
    if (existingReason) {
      parts.push(existingReason);
    }

    if (status === "won") {
      const reasonForWin = this.getFieldValue(rawRecord, "Reason_for_Win");
      const whyBought = this.getFieldValue(rawRecord, "Why_They_Bought");
      if (reasonForWin) parts.push(reasonForWin);
      if (whyBought) parts.push(whyBought);
    } else if (status === "lost") {
      const lostReason = this.getFieldValue(rawRecord, "Lost_Reason");
      const lostDetails = this.getFieldValue(rawRecord, "Lost_Reason_Details");
      const priceReason = this.getFieldValue(rawRecord, "Price_Reason");
      if (lostReason) parts.push(lostReason);
      if (lostDetails) parts.push(lostDetails);
      if (priceReason) parts.push(`Price factor: ${priceReason}`);
    }

    return parts.join(" | ");
  }

  /**
   * Simpro sales stage order — used to sort funnel output.
   * "Contract Review" is mapped to the same position as "Commitment"
   * since some Salesforce instances use the older label.
   */
  static readonly STAGE_ORDER: Record<string, number> = {
    "Discovery": 1,
    "Validation": 2,
    "Solution Review & Quote": 3,
    "Commitment": 4,
    "Contract Review": 4, // Legacy SF label — same as Commitment
    "Closed Won": 5,
    "Closed Lost": 6,
  };

  /**
   * Calculates funnel stages from parsed records, sorted by Simpro stage order.
   * Stages not in STAGE_ORDER are appended at the end.
   */
  static calculateFunnel(
    records: OpportunityRecord[]
  ): Array<{ stage: string; count: number; revenue: number }> {
    const stageMap: Record<string, { count: number; revenue: number }> = {};

    for (const record of records) {
      const stage = record.stage || "Unknown";
      if (!stageMap[stage]) {
        stageMap[stage] = { count: 0, revenue: 0 };
      }
      stageMap[stage].count++;
      stageMap[stage].revenue += record.amount || 0;
    }

    return Object.entries(stageMap)
      .map(([stage, data]) => ({
        stage,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => {
        const orderA = CSVParser.STAGE_ORDER[a.stage] ?? 99;
        const orderB = CSVParser.STAGE_ORDER[b.stage] ?? 99;
        return orderA - orderB;
      });
  }

  /**
   * Validates that all required fields are present
   */
  static validateFieldMapping(mapping: FieldMapping): void {
    // winLossStatus is not strictly required — can be derived from Stage or Closed/Won booleans
    const requiredFields = [
      "opportunityId",
      "accountName",
      "opportunityName",
      "stage",
      "notes",
    ];

    for (const field of requiredFields) {
      if (!mapping[field as keyof FieldMapping]) {
        throw new Error(`Required field mapping missing: ${field}`);
      }
    }
  }
}

/**
 * Gets default Salesforce field mapping for standard SFDC exports
 */
export function getDefaultSalesforceMapping(): FieldMapping {
  return {
    opportunityId: "Opportunity_ID",
    accountName: "Opportunity_Name",
    opportunityName: "Opportunity_Name",
    stage: "Stage",
    amount: "Amount",
    closedDate: "Close_Date",
    winLossStatus: "Category",
    winLossReason: "Reason_for_Win",
    notes: "Why_They_Bought",
    dealReviewNotes: "Close_Plan",
    salesRep: "Decision_Maker",
    // New Tier 2 fields — column name alternatives handled by COLUMN_ALTERNATIVES
    lastActivityDate: "Last_Activity_Date",
    nextStep: "Next_Step",
    probability: "Probability",
    forecastCategory: "Forecast_Category",
    leadSource: "Lead_Source",
    dealType: "Type",
    economicBuyer: "Economic_Buyer",
    productLine: "simPRO_Company",
  };
}

/**
 * Gets default region mapping
 */
export function getDefaultRegionMapping(): RegionMapping {
  return {
    // Country/continent level
    "North America": "NAMER",
    "United States": "NAMER",
    "Canada": "NAMER",
    "Europe": "EMEA",
    "United Kingdom": "EMEA",
    "Germany": "EMEA",
    "France": "EMEA",
    "APAC": "APAC",
    "Australia": "APAC",
    "New Zealand": "APAC",
    "Japan": "APAC",
    "Singapore": "APAC",
    "India": "APAC",
    "Latin America": "LATAM",
    "Mexico": "LATAM",
    "Brazil": "LATAM",
    // Australian states
    "New South Wales": "APAC",
    "Queensland": "APAC",
    "Victoria": "APAC",
    "Western Australia": "APAC",
    "South Australia": "APAC",
    "Australian Capital Territory": "APAC",
    "Tasmania": "APAC",
    "Northern Territory": "APAC",
    // UK regions
    "England": "EMEA",
    "Scotland": "EMEA",
    "Wales": "EMEA",
    "Northern Ireland": "EMEA",
  };
}
