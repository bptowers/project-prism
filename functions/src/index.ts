/**
 * Project Prism - Firebase Cloud Functions Entry Point
 * Defines all Cloud Functions and orchestrates the complete pipeline
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Storage } from "@google-cloud/storage";
import { Analyzer } from "./analysis/analyzer.js";
import { Aggregator } from "./analysis/aggregator.js";
import { CSVParser, getDefaultSalesforceMapping, getDefaultRegionMapping } from "./pipeline/csvParser.js";
import { DataValidator } from "./pipeline/validator.js";
import {
  AggregatedReport,
  ExecutionContext,
  LLMConfig,
  OpportunityRecord,
} from "./types.js";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();

/**
 * Configuration - typically loaded from environment variables or Firestore
 */
function getLLMConfig(): LLMConfig {
  const provider = process.env.LLM_PROVIDER || "claude";
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "claude-3-5-sonnet-20241022";

  if (!apiKey) {
    throw new Error("LLM_API_KEY environment variable not set");
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
export const onCSVUpload = functions.storage
  .bucket("project-prism-uploads")
  .onFinalize(async (object) => {
    const filePath = object.name;
    const bucketName = object.bucket;

    if (!filePath.startsWith("uploads/") || !filePath.endsWith(".csv")) {
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

      // Run full pipeline
      const report = await runAnalysisPipeline(
        records,
        context,
        getLLMConfig()
      );

      // Store report in Firestore
      const reportDate = new Date().toISOString().split("T")[0];
      await db.collection("reports").doc(reportDate).set(report);

      console.log(
        `[${context.executionId}] Report stored: ${report.reportId}`
      );

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
  });

/**
 * Scheduled function: Runs weekly analysis
 * Trigger: Every Monday at 6:00 AM UTC
 */
export const runWeeklyAnalysis = functions.pubsub
  .schedule("0 6 * * 1")
  .timeZone("UTC")
  .onRun(async () => {
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

      // Run analysis pipeline
      const report = await runAnalysisPipeline(
        records,
        context,
        getLLMConfig()
      );

      // Store report
      const reportDate = new Date().toISOString().split("T")[0];
      await db.collection("reports").doc(reportDate).set(report);

      console.log(
        `[${context.executionId}] Weekly analysis complete: ${report.reportId}`
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
  });

/**
 * HTTP function: Returns the latest aggregated report
 * GET /getReport
 */
export const getReport = functions.https.onRequest(async (req, res) => {
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
        return res.status(404).json({ error: "No reports found" });
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
export const getReportHistory = functions.https.onRequest(async (req, res) => {
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
export const uploadCSV = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Note: In production, this would use Busboy or similar to parse multipart form data
    // For this example, we assume CSV content is in req.body as text or base64

    if (!req.body.csv) {
      return res.status(400).json({ error: "CSV content required" });
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
