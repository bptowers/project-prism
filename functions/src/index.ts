/**
 * Project Prism - Firebase Cloud Functions Entry Point
 * Defines all Cloud Functions and orchestrates the complete pipeline
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { Storage } from "@google-cloud/storage";
import { Analyzer } from "./analysis/analyzer.js";
import { Aggregator } from "./analysis/aggregator.js";
import { CSVParser, getDefaultSalesforceMapping, getDefaultRegionMapping } from "./pipeline/csvParser.js";
import { DataValidator } from "./pipeline/validator.js";
import { ReportTransformer } from "./transforms/reportTransformer.js";
import {
  AggregatedReport,
  ExecutionContext,
  LLMConfig,
  OpportunityRecord,
} from "./types.js";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const storage = new Storage();

/**
 * Configuration - typically loaded from environment variables or Firestore
 */
function getLLMConfig(): LLMConfig {
  const provider = process.env.LLM_PROVIDER || "claude";
  const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  const model = process.env.LLM_MODEL || "claude-sonnet-4-5-20250929";

  if (!apiKey) {
    throw new Error("LLM_API_KEY or ANTHROPIC_API_KEY environment variable not set");
  }

  return {
    provider: provider as "claude" | "gemini" | "openai",
    model,
    apiKey,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.3"),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "2000", 10),
    topP: parseFloat(process.env.LLM_TOP_P || "0.9"),
  };
}

/**
 * Creates execution context for tracking pipeline progress
 */
function createExecutionContext(jobType: ExecutionContext["jobType"], sourceFile?: string): ExecutionContext {
  return {
    executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    startTime: new Date(),
    jobType,
    sourceFile,
    recordsProcessed: 0,
    recordsSuccessful: 0,
    recordsFailed: 0,
    status: "running",
    errors: [],
  };
}

/**
 * Cloud Storage trigger: Processes CSV uploads
 * Function: onCSVUpload
 * Trigger: gs://project-prism-uploads/
 */
export const onCSVUpload = onObjectFinalized(
  { bucket: "project-prism-uploads", timeoutSeconds: 3600, memory: "1GiB" },
  async (event) => {
    const filePath = event.data.name;
    const bucketName = event.data.bucket;

    if (!filePath || !filePath.startsWith("uploads/") || !filePath.endsWith(".csv")) {
      console.log(`Skipping non-CSV file: ${filePath}`);
      return;
    }

    const context = createExecutionContext("csv-upload", filePath);
    console.log(`[${context.executionId}] CSV upload detected: ${filePath}`);

    try {
      // Read CSV from Cloud Storage
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      const [csvContent] = await file.download();
      const csvText = csvContent.toString("utf-8");

      // Parse CSV
      const parser = new CSVParser(
        getDefaultSalesforceMapping(),
        getDefaultRegionMapping()
      );
      const records = parser.parse(csvText);

      console.log(
        `[${context.executionId}] Parsed ${records.length} records from CSV`
      );

      // Compute funnel stages from raw CSV
      const funnelStages = CSVParser.calculateFunnel(records);

      // Run full pipeline
      const report = await runAnalysisPipeline(
        records,
        context,
        getLLMConfig()
      );

      // Add funnel stages from CSV data
      report.funnelStages = funnelStages;

      // Transform for frontend consumption (without LLM enrichment first)
      const transformed = ReportTransformer.transform(report);

      // Store base report in Firestore immediately so dashboard gets data
      const reportDate = new Date().toISOString().split("T")[0];
      const reportRef = db.collection("reports").doc(reportDate);
      await reportRef.set({
        ...report,
        transformed,
        reportDate: report.reportDate,
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `[${context.executionId}] Report stored: ${report.reportId}`
      );

      // Try LLM enrichment as a follow-up (portfolio analysis, recommendations)
      try {
        const enrichedReport = await Aggregator.enrichWithLLM(report, getLLMConfig());
        enrichedReport.funnelStages = funnelStages;
        const enrichedTransformed = ReportTransformer.transform(enrichedReport);
        await reportRef.update({
          ...enrichedReport,
          transformed: enrichedTransformed,
          enrichedAt: FieldValue.serverTimestamp(),
        });
        console.log(
          `[${context.executionId}] Report enriched with portfolio analysis`
        );
      } catch (enrichErr) {
        console.warn(
          `[${context.executionId}] LLM enrichment skipped: ${String(enrichErr)}`
        );
      }

      // Update execution status
      context.status = "completed";
      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
    } catch (error) {
      context.status = "failed";
      context.errors.push(`Pipeline error: ${String(error)}`);
      console.error(`[${context.executionId}] Pipeline error:`, error);

      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
      throw error;
    }
  }
);

/**
 * Scheduled function: Runs weekly analysis
 * Trigger: Every Monday at 6:00 AM UTC
 */
export const runWeeklyAnalysis = onSchedule(
  { schedule: "0 6 * * 1", timeZone: "UTC" },
  async () => {
    const context = createExecutionContext("scheduled-weekly");
    console.log(`[${context.executionId}] Weekly analysis started`);

    try {
      // Get the latest CSV from uploads
      const bucket = storage.bucket("project-prism-uploads");
      const [files] = await bucket.getFiles({ prefix: "uploads/" });

      if (files.length === 0) {
        console.log(`[${context.executionId}] No CSV files found`);
        return;
      }

      // Get the most recent file
      const latestFile = files.sort((a, b) => {
        const aTime = a.metadata.timeCreated || "";
        const bTime = b.metadata.timeCreated || "";
        return aTime < bTime ? 1 : -1;
      })[0];

      context.sourceFile = latestFile.name;
      console.log(
        `[${context.executionId}] Processing file: ${latestFile.name}`
      );

      // Download and parse CSV
      const [csvContent] = await latestFile.download();
      const csvText = csvContent.toString("utf-8");

      const parser = new CSVParser(
        getDefaultSalesforceMapping(),
        getDefaultRegionMapping()
      );
      const records = parser.parse(csvText);

      console.log(
        `[${context.executionId}] Parsed ${records.length} records`
      );

      // Compute funnel stages
      const funnelStages = CSVParser.calculateFunnel(records);

      // Run analysis pipeline
      const report = await runAnalysisPipeline(
        records,
        context,
        getLLMConfig()
      );

      // Enrich and transform
      const enrichedReport = await Aggregator.enrichWithLLM(report, getLLMConfig());
      enrichedReport.funnelStages = funnelStages;
      const transformed = ReportTransformer.transform(enrichedReport);

      // Store report
      const reportDate = new Date().toISOString().split("T")[0];
      await db.collection("reports").doc(reportDate).set({
        ...enrichedReport,
        transformed,
        reportDate: enrichedReport.reportDate,
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `[${context.executionId}] Weekly analysis complete: ${enrichedReport.reportId}`
      );

      context.status = "completed";
      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
    } catch (error) {
      context.status = "failed";
      context.errors.push(`Weekly analysis error: ${String(error)}`);
      console.error(`[${context.executionId}] Error:`, error);

      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
      throw error;
    }
  }
);

/**
 * HTTP function: Returns the latest aggregated report
 * GET /getReport
 */
export const getReport = onRequest(async (_req, res) => {
  try {
    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Try to fetch report for today
    let reportDoc = await db.collection("reports").doc(today).get();

    // If not found, get the most recent report
    if (!reportDoc.exists) {
      const snapshot = await db
        .collection("reports")
        .orderBy("reportDate", "desc")
        .limit(1)
        .get();

      if (snapshot.empty) {
        res.status(404).json({ error: "No reports found" });
        return;
      }

      reportDoc = snapshot.docs[0];
    }

    const report = reportDoc.data() as AggregatedReport;

    res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      error: `Failed to fetch report: ${String(error)}`,
    });
  }
});

/**
 * HTTP function: Returns report history (last 10 reports)
 * GET /getReportHistory
 */
export const getReportHistory = onRequest(async (_req, res) => {
  try {
    const snapshot = await db
      .collection("reports")
      .orderBy("reportDate", "desc")
      .limit(10)
      .get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as AggregatedReport),
    }));

    res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Error fetching report history:", error);
    res.status(500).json({
      error: `Failed to fetch report history: ${String(error)}`,
    });
  }
});

/**
 * HTTP function: Accepts CSV file upload via multipart form
 * POST /uploadCSV
 */
export const uploadCSV = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!req.body.csv) {
      res.status(400).json({ error: "CSV content required" });
      return;
    }

    const csvContent = req.body.csv;
    const filename = req.body.filename || `upload_${Date.now()}.csv`;

    // Upload to Cloud Storage
    const bucket = storage.bucket("project-prism-uploads");
    const file = bucket.file(`uploads/${filename}`);

    await file.save(csvContent, {
      metadata: {
        contentType: "text/csv",
      },
    });

    console.log(`CSV uploaded: ${filename}`);

    res.status(200).json({
      success: true,
      message: "CSV uploaded successfully",
      filename,
    });
  } catch (error) {
    console.error("Error uploading CSV:", error);
    res.status(500).json({
      error: `Failed to upload CSV: ${String(error)}`,
    });
  }
});

/**
 * Main analysis pipeline orchestrator
 * Coordinates: Validation -> Analysis -> Aggregation -> Storage
 */
async function runAnalysisPipeline(
  records: OpportunityRecord[],
  context: ExecutionContext,
  llmConfig: LLMConfig
): Promise<AggregatedReport> {
  const pipelineStartTime = context.startTime.toISOString();

  // Step 1: Validate records
  console.log(`[${context.executionId}] Running validation...`);
  const validator = new DataValidator(true);
  const validationReport = validator.validateBatch(records);

  console.log(
    `[${context.executionId}] Validation complete: ${validationReport.validRecords}/${validationReport.totalRecords} valid`
  );

  // Step 2: Create analyzer and run analysis
  console.log(`[${context.executionId}] Initializing analyzer...`);
  const analyzer = await Analyzer.create(llmConfig, 25, 3, 1000);

  console.log(`[${context.executionId}] Running LLM analysis...`);
  const analyses = await analyzer.analyze(records, context);

  console.log(
    `[${context.executionId}] Analysis complete: ${analyses.length} successful analyses`
  );

  // Step 3: Store individual analyses
  const batch = db.batch();
  for (const analysis of analyses) {
    const docRef = db
      .collection("analyses")
      .doc(context.executionId)
      .collection("opportunities")
      .doc(analysis.opportunityId);

    batch.set(docRef, analysis);
  }
  await batch.commit();

  console.log(`[${context.executionId}] Stored ${analyses.length} individual analyses`);

  // Step 4: Aggregate results
  console.log(`[${context.executionId}] Aggregating results...`);
  const report = Aggregator.aggregate(
    analyses,
    pipelineStartTime,
    analyzer.getProviderInfo().name,
    analyzer.getProviderInfo().model,
    validationReport.averageQualityScore
  );

  console.log(`[${context.executionId}] Aggregation complete: ${report.reportId}`);

  return report;
}
