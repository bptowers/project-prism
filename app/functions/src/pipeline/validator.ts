/**
 * Project Prism - Data Validator Module
 * Validates opportunity records and handles PII detection/scrubbing
 */

import {
  OpportunityRecord,
  RecordValidation,
  ValidationReport,
} from "../types.js";

/**
 * Data validator for opportunity records
 * Performs quality checks, PII detection, and optional scrubbing
 */
export class DataValidator {
  private enablePiiScrubbing: boolean;

  // PII detection patterns
  private readonly piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone:
      /(\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  };

  /**
   * Initialize validator with configuration
   */
  constructor(enablePiiScrubbing: boolean = true) {
    this.enablePiiScrubbing = enablePiiScrubbing;
  }

  /**
   * Validates a batch of opportunity records
   */
  validateBatch(records: OpportunityRecord[]): ValidationReport {
    const recordValidations = records.map((record, index) =>
      this.validateRecord(record, index)
    );

    const validRecords = recordValidations.filter((v) => v.isValid).length;
    const invalidRecords = recordValidations.filter((v) => !v.isValid).length;
    const qualityScores = recordValidations.map((v) => v.qualityScore);
    const averageQualityScore =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    const totalPiiIssues = recordValidations.reduce(
      (sum, v) => sum + v.piiFlags.length,
      0
    );

    return {
      totalRecords: records.length,
      validRecords,
      invalidRecords,
      averageQualityScore: Math.round(averageQualityScore * 100) / 100,
      totalPiiIssues,
      recordValidations,
      timestamp: new Date(),
    };
  }

  /**
   * Validates a single opportunity record
   */
  private validateRecord(
    record: OpportunityRecord,
    index: number
  ): RecordValidation {
    const validation: RecordValidation = {
      recordId: record.opportunityId || `record_${index}`,
      isValid: true,
      qualityScore: 100,
      errors: [],
      warnings: [],
      piiFlags: [],
      hasScrubbedContent: false,
    };

    // Check required fields
    if (!record.opportunityId || record.opportunityId.trim() === "") {
      validation.errors.push("Missing opportunityId");
      validation.isValid = false;
      validation.qualityScore -= 25;
    }

    if (!record.accountName || record.accountName.trim() === "") {
      validation.errors.push("Missing accountName");
      validation.isValid = false;
      validation.qualityScore -= 20;
    }

    if (!record.stage || record.stage.trim() === "") {
      validation.errors.push("Missing stage");
      validation.isValid = false;
      validation.qualityScore -= 20;
    }

    if (!record.notes || record.notes.trim() === "") {
      validation.warnings.push("Empty notes field");
      validation.qualityScore -= 15;
    }

    // Check for PII
    const piiDetected = this.detectPII(record);
    if (piiDetected.found.length > 0) {
      validation.piiFlags = piiDetected.found;
      validation.qualityScore -= piiDetected.found.length * 5;

      if (this.enablePiiScrubbing) {
        this.scrubbRecord(record);
        validation.hasScrubbedContent = true;
      }
    }

    // Check data completeness
    const completeness = this.calculateCompleteness(record);
    if (completeness < 50) {
      validation.warnings.push("Low data completeness");
      validation.qualityScore = Math.min(validation.qualityScore, 50);
    }

    // Ensure quality score is between 0-100
    validation.qualityScore = Math.max(0, Math.min(100, validation.qualityScore));

    // Invalid if errors exist
    validation.isValid = validation.errors.length === 0;

    return validation;
  }

  /**
   * Detects PII in a record
   */
  private detectPII(record: OpportunityRecord): {
    found: string[];
    locations: Record<string, number>;
  } {
    const found: string[] = [];
    const locations: Record<string, number> = {};

    const fieldsToCheck = [
      record.notes,
      record.dealReviewNotes,
      record.accountName,
      record.winLossReason,
    ];

    for (const [piiType, pattern] of Object.entries(this.piiPatterns)) {
      for (const field of fieldsToCheck) {
        if (field && pattern.test(field)) {
          const matches = field.match(pattern) || [];
          if (matches.length > 0) {
            found.push(piiType);
            locations[piiType] = (locations[piiType] || 0) + matches.length;
          }
          // Reset regex for next iteration
          pattern.lastIndex = 0;
        }
      }
    }

    return { found: [...new Set(found)], locations };
  }

  /**
   * Scrubs PII from a record
   */
  private scrubbRecord(record: OpportunityRecord): void {
    // Scrub notes
    if (record.notes) {
      record.notes = this.scrubText(record.notes);
    }

    // Scrub deal review notes
    if (record.dealReviewNotes) {
      record.dealReviewNotes = this.scrubText(record.dealReviewNotes);
    }

    // Scrub win/loss reason
    if (record.winLossReason) {
      record.winLossReason = this.scrubText(record.winLossReason);
    }
  }

  /**
   * Scrubs PII from a text field
   */
  private scrubText(text: string): string {
    let scrubbed = text;

    // Email
    scrubbed = scrubbed.replace(
      this.piiPatterns.email,
      "[EMAIL_REDACTED]"
    );

    // Phone
    scrubbed = scrubbed.replace(
      this.piiPatterns.phone,
      "[PHONE_REDACTED]"
    );

    // SSN
    scrubbed = scrubbed.replace(
      this.piiPatterns.ssn,
      "[SSN_REDACTED]"
    );

    // Credit card
    scrubbed = scrubbed.replace(
      this.piiPatterns.creditCard,
      "[CARD_REDACTED]"
    );

    // IP address
    scrubbed = scrubbed.replace(
      this.piiPatterns.ipAddress,
      "[IP_REDACTED]"
    );

    return scrubbed;
  }

  /**
   * Calculates data completeness percentage (0-100)
   */
  private calculateCompleteness(record: OpportunityRecord): number {
    const totalFields = 14; // Number of possible fields
    let completedFields = 0;

    const fieldsToCheck = [
      record.opportunityId,
      record.accountName,
      record.opportunityName,
      record.stage,
      record.amount,
      record.closedDate,
      record.winLossStatus,
      record.winLossReason,
      record.notes,
      record.region,
      record.industry,
      record.dealReviewNotes,
      record.createdDate,
      record.salesRep,
    ];

    for (const field of fieldsToCheck) {
      if (field && String(field).trim() !== "") {
        completedFields++;
      }
    }

    return (completedFields / totalFields) * 100;
  }

  /**
   * Gets validation summary statistics
   */
  static getSummary(report: ValidationReport): {
    passRate: number;
    avgQuality: number;
    piiIssueRate: number;
  } {
    return {
      passRate:
        report.totalRecords > 0
          ? Math.round((report.validRecords / report.totalRecords) * 100)
          : 0,
      avgQuality: report.averageQualityScore,
      piiIssueRate:
        report.totalRecords > 0
          ? Math.round(
              (report.totalPiiIssues / report.recordValidations.length) * 100
            )
          : 0,
    };
  }
}
