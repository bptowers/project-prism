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
      stage: this.getFieldValue(rawRecord, this.fieldMapping.stage),
      winLossStatus: this.normalizeWinLossStatus(
        this.getFieldValue(rawRecord, this.fieldMapping.winLossStatus)
      ),
      notes: this.getFieldValue(rawRecord, this.fieldMapping.notes) || "",
      region: "Unknown",
    };

    // Optional fields
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

    // Tag with region based on account name or industry
    record.region = this.detectRegion(record);

    return record;
  }

  /**
   * Gets field value from raw record, handling missing fields gracefully
   */
  private getFieldValue(record: Record<string, unknown>, fieldName: string): string {
    const value = record[fieldName];
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).trim();
  }

  /**
   * Normalizes win/loss status values
   */
  private normalizeWinLossStatus(
    status: string
  ): "won" | "lost" | "active" {
    const normalized = status.toLowerCase().trim();

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
   * Detects region based on account name and other fields
   */
  private detectRegion(record: OpportunityRecord): string {
    // Try to match account name or industry against region mapping
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

    // Default to Unknown
    return "Unknown";
  }

  /**
   * Validates that all required fields are present
   */
  static validateFieldMapping(mapping: FieldMapping): void {
    const requiredFields = [
      "opportunityId",
      "accountName",
      "opportunityName",
      "stage",
      "winLossStatus",
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
    accountName: "Account_Name",
    opportunityName: "Opportunity_Name",
    stage: "Stage",
    amount: "Amount",
    closedDate: "Close_Date",
    winLossStatus: "Win_Loss_Status",
    winLossReason: "Win_Loss_Reason",
    notes: "Notes",
    industry: "Industry",
    dealReviewNotes: "Deal_Review_Notes",
    createdDate: "Created_Date",
    updatedDate: "Last_Modified_Date",
    salesRep: "Sales_Rep",
  };
}

/**
 * Gets default region mapping
 */
export function getDefaultRegionMapping(): RegionMapping {
  return {
    "North America": "NAMER",
    "United States": "NAMER",
    "Canada": "NAMER",
    "Europe": "EMEA",
    "United Kingdom": "EMEA",
    "Germany": "EMEA",
    "France": "EMEA",
    "APAC": "APAC",
    "Australia": "APAC",
    "Japan": "APAC",
    "Singapore": "APAC",
    "India": "APAC",
    "Latin America": "LATAM",
    "Mexico": "LATAM",
    "Brazil": "LATAM",
  };
}
